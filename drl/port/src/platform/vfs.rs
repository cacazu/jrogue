//! A bounded in-memory filesystem for the original Pascal/Lua WASI core.
//! All paths refer to this tree; this adapter has no host filesystem capability.
//! Its checkpoint stores file bytes, never a replacement for native game saves.
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};

pub const MAX_FILE_BYTES: usize = 16 * 1024 * 1024;
pub const MAX_TOTAL_BYTES: usize = 64 * 1024 * 1024;
pub const MAX_ENTRIES: usize = 4096;
pub const MAX_HANDLES: usize = 4096;
pub const MAX_TRANSFER_BYTES: usize = 64 * 1024;
pub const MAX_PATH_BYTES: usize = 1024;
pub const ROOT_FD: u32 = 3;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Error {
    InvalidPath,
    NotCapable,
    NoEntry,
    Exists,
    NotDirectory,
    IsDirectory,
    BadDescriptor,
    ReadOnly,
    NotEmpty,
    InvalidSeek,
    InvalidTime,
    Quota,
    InvalidCheckpoint,
}
impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{self:?}")
    }
}
impl std::error::Error for Error {}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Kind {
    File,
    Directory,
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Stat {
    pub kind: Kind,
    pub bytes: u64,
    pub readonly: bool,
}
/// WASI nanosecond timestamps are independent of content/open-handle rights.
/// Decimal strings preserve the complete u64 range at the JavaScript boundary.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct FileTimes {
    #[serde(with = "timestamp_decimal")]
    pub atime: u64,
    #[serde(with = "timestamp_decimal")]
    pub mtime: u64,
    #[serde(with = "timestamp_decimal")]
    pub ctime: u64,
}

fn canonical_timestamp(text: &str) -> Result<u64, Error> {
    if text.is_empty()
        || (text.len() > 1 && text.starts_with('0'))
        || !text.bytes().all(|byte| byte.is_ascii_digit())
    {
        return Err(Error::InvalidTime);
    }
    text.parse().map_err(|_| Error::InvalidTime)
}

mod timestamp_decimal {
    use serde::{Deserialize, Deserializer, Serializer, de::Error as _};

    pub fn serialize<S: Serializer>(value: &u64, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&value.to_string())
    }

    pub fn deserialize<'de, D: Deserializer<'de>>(deserializer: D) -> Result<u64, D::Error> {
        let text = String::deserialize(deserializer)?;
        super::canonical_timestamp(&text)
            .map_err(|_| D::Error::custom("invalid canonical nanosecond timestamp"))
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Entry {
    kind: Kind,
    readonly: bool,
    bytes: Vec<u8>,
    #[serde(default)]
    times: FileTimes,
}
impl Entry {
    fn directory(readonly: bool) -> Self {
        Self {
            kind: Kind::Directory,
            readonly,
            bytes: Vec::new(),
            times: FileTimes::default(),
        }
    }
    fn stat(&self) -> Stat {
        Stat {
            kind: self.kind,
            bytes: self.bytes.len() as u64,
            readonly: self.readonly,
        }
    }
}
#[derive(Debug, Clone)]
struct Handle {
    path: String,
    cursor: u64,
    writable: bool,
    append: bool,
}
#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub struct Open {
    pub create: bool,
    pub exclusive: bool,
    pub truncate: bool,
    pub writable: bool,
    pub append: bool,
    pub directory: bool,
}
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Whence {
    Start,
    Current,
    End,
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DirEntry {
    pub name: String,
    pub kind: Kind,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Checkpoint {
    version: u32,
    entries: BTreeMap<String, Entry>,
}

#[derive(Debug, Clone)]
pub struct FileSystem {
    entries: BTreeMap<String, Entry>,
    handles: BTreeMap<u32, Handle>,
    total_bytes: usize,
}
impl Default for FileSystem {
    fn default() -> Self {
        Self::new()
    }
}

/// Canonical paths are absolute UTF-8 POSIX paths with no trailing separator.
/// Traversal beyond the opened directory is rejected instead of normalized away.
fn resolve(base: &str, path: &str) -> Result<String, Error> {
    if path.len() > MAX_PATH_BYTES || path.is_empty() || path.contains(['\0', '\\']) {
        return Err(Error::InvalidPath);
    }
    if path.starts_with('/') {
        return Err(Error::NotCapable);
    }
    let mut parts: Vec<&str> = base.split('/').filter(|s| !s.is_empty()).collect();
    let floor = parts.len();
    for part in path.split('/') {
        match part {
            "" | "." => {}
            ".." if parts.len() == floor => return Err(Error::NotCapable),
            ".." => {
                parts.pop();
            }
            s if s.len() > 255 => return Err(Error::InvalidPath),
            s => parts.push(s),
        }
    }
    let value = format!("/{}", parts.join("/"));
    if value.len() > MAX_PATH_BYTES {
        return Err(Error::InvalidPath);
    }
    Ok(value)
}
fn parent(path: &str) -> &str {
    path.rsplit_once('/')
        .map_or("/", |(base, _)| if base.is_empty() { "/" } else { base })
}

impl FileSystem {
    pub fn new() -> Self {
        Self {
            entries: BTreeMap::from([("/".into(), Entry::directory(false))]),
            handles: BTreeMap::from([(
                ROOT_FD,
                Handle {
                    path: "/".into(),
                    cursor: 0,
                    writable: true,
                    append: false,
                },
            )]),
            total_bytes: 0,
        }
    }
    fn directory(&self, fd: u32) -> Result<&str, Error> {
        let handle = self.handles.get(&fd).ok_or(Error::BadDescriptor)?;
        let entry = self.entries.get(&handle.path).ok_or(Error::NoEntry)?;
        if entry.kind != Kind::Directory {
            return Err(Error::NotDirectory);
        }
        Ok(&handle.path)
    }
    fn path(&self, fd: u32, path: &str) -> Result<String, Error> {
        resolve(self.directory(fd)?, path)
    }
    fn check_parent(&self, path: &str) -> Result<(), Error> {
        let entry = self.entries.get(parent(path)).ok_or(Error::NoEntry)?;
        if entry.kind != Kind::Directory {
            return Err(Error::NotDirectory);
        }
        if entry.readonly {
            return Err(Error::ReadOnly);
        }
        Ok(())
    }
    fn quota(&self, old_size: usize, new_size: usize, extra_entries: usize) -> Result<(), Error> {
        let total = self
            .total_bytes
            .checked_sub(old_size)
            .and_then(|n| n.checked_add(new_size))
            .ok_or(Error::Quota)?;
        if new_size > MAX_FILE_BYTES
            || total > MAX_TOTAL_BYTES
            || self.entries.len().saturating_add(extra_entries) > MAX_ENTRIES
        {
            return Err(Error::Quota);
        }
        Ok(())
    }
    /// Preload verified game resources before opening the native core. Existing paths
    /// cannot be replaced, and newly created ancestors are directories.
    pub fn mount_asset(&mut self, path: &str, bytes: Vec<u8>) -> Result<(), Error> {
        let path = resolve("/", path)?;
        if path == "/" || self.entries.contains_key(&path) {
            return Err(Error::Exists);
        }
        let mut missing = Vec::new();
        let mut ancestor = parent(&path);
        while !self.entries.contains_key(ancestor) {
            missing.push(ancestor.to_string());
            ancestor = parent(ancestor);
        }
        if self.entries[ancestor].kind != Kind::Directory {
            return Err(Error::NotDirectory);
        }
        self.quota(0, bytes.len(), missing.len() + 1)?;
        for dir in missing.into_iter().rev() {
            self.entries.insert(dir, Entry::directory(true));
        }
        self.total_bytes += bytes.len();
        self.entries.insert(
            path,
            Entry {
                kind: Kind::File,
                readonly: true,
                bytes,
                times: FileTimes::default(),
            },
        );
        Ok(())
    }
    pub fn stat_path(&self, fd: u32, path: &str) -> Result<Stat, Error> {
        Ok(self
            .entries
            .get(&self.path(fd, path)?)
            .ok_or(Error::NoEntry)?
            .stat())
    }
    pub fn stat_fd(&self, fd: u32) -> Result<Stat, Error> {
        let path = &self.handles.get(&fd).ok_or(Error::BadDescriptor)?.path;
        Ok(self.entries.get(path).ok_or(Error::NoEntry)?.stat())
    }
    pub fn get_times(&self, fd: u32) -> Result<FileTimes, Error> {
        let path = &self.handles.get(&fd).ok_or(Error::BadDescriptor)?.path;
        Ok(self.entries.get(path).ok_or(Error::NoEntry)?.times)
    }
    pub fn get_path_times(&self, dir_fd: u32, path: &str) -> Result<FileTimes, Error> {
        let path = self.path(dir_fd, path)?;
        Ok(self.entries.get(&path).ok_or(Error::NoEntry)?.times)
    }
    /// The host supplies ctime after resolving WASI NOW flags. Missing atime or
    /// mtime leaves that value unchanged; content-write rights are not required
    /// for metadata on owned entries. Mounted resources remain immutable.
    pub fn set_times(
        &mut self,
        fd: u32,
        atime: Option<u64>,
        mtime: Option<u64>,
        ctime: u64,
    ) -> Result<(), Error> {
        let path = &self.handles.get(&fd).ok_or(Error::BadDescriptor)?.path;
        let entry = self.entries.get_mut(path).ok_or(Error::NoEntry)?;
        Self::update_times(entry, atime, mtime, ctime)
    }
    pub fn set_path_times(
        &mut self,
        dir_fd: u32,
        path: &str,
        atime: Option<u64>,
        mtime: Option<u64>,
        ctime: u64,
    ) -> Result<(), Error> {
        let path = self.path(dir_fd, path)?;
        let entry = self.entries.get_mut(&path).ok_or(Error::NoEntry)?;
        Self::update_times(entry, atime, mtime, ctime)
    }
    fn update_times(
        entry: &mut Entry,
        atime: Option<u64>,
        mtime: Option<u64>,
        ctime: u64,
    ) -> Result<(), Error> {
        if entry.readonly {
            return Err(Error::ReadOnly);
        }
        entry.times = FileTimes {
            atime: atime.unwrap_or(entry.times.atime),
            mtime: mtime.unwrap_or(entry.times.mtime),
            ctime,
        };
        Ok(())
    }
    pub fn open(&mut self, dir_fd: u32, path: &str, flags: Open) -> Result<u32, Error> {
        if self.handles.len() >= MAX_HANDLES {
            return Err(Error::Quota);
        }
        if (flags.append || flags.truncate) && !flags.writable {
            return Err(Error::NotCapable);
        }
        let path = self.path(dir_fd, path)?;
        let mut exists = self.entries.get(&path);
        if exists.is_some() && flags.create && flags.exclusive {
            return Err(Error::Exists);
        }
        if exists.is_none() {
            if !flags.create {
                return Err(Error::NoEntry);
            }
            if flags.directory {
                return Err(Error::NotDirectory);
            }
            self.check_parent(&path)?;
            self.quota(0, 0, 1)?;
            self.entries.insert(
                path.clone(),
                Entry {
                    kind: Kind::File,
                    readonly: false,
                    bytes: Vec::new(),
                    times: FileTimes::default(),
                },
            );
            exists = self.entries.get(&path);
        }
        let entry = exists.ok_or(Error::NoEntry)?;
        if flags.directory && entry.kind != Kind::Directory {
            return Err(Error::NotDirectory);
        }
        if entry.readonly && (flags.writable || flags.truncate) {
            return Err(Error::ReadOnly);
        }
        if entry.kind == Kind::Directory && (flags.truncate || flags.append) {
            return Err(Error::IsDirectory);
        }
        if flags.truncate {
            self.total_bytes -= entry.bytes.len();
            self.entries
                .get_mut(&path)
                .ok_or(Error::NoEntry)?
                .bytes
                .clear();
        }
        let fd = (4..u32::MAX)
            .find(|fd| !self.handles.contains_key(fd))
            .ok_or(Error::Quota)?;
        self.handles.insert(
            fd,
            Handle {
                path,
                cursor: 0,
                writable: flags.writable,
                append: flags.append,
            },
        );
        Ok(fd)
    }
    pub fn close(&mut self, fd: u32) -> Result<(), Error> {
        if fd == ROOT_FD {
            return Err(Error::NotCapable);
        }
        self.handles.remove(&fd).ok_or(Error::BadDescriptor)?;
        Ok(())
    }
    pub fn read(&mut self, fd: u32, length: usize) -> Result<Vec<u8>, Error> {
        if length > MAX_TRANSFER_BYTES {
            return Err(Error::Quota);
        }
        let handle = self.handles.get_mut(&fd).ok_or(Error::BadDescriptor)?;
        let entry = self.entries.get(&handle.path).ok_or(Error::NoEntry)?;
        if entry.kind != Kind::File {
            return Err(Error::IsDirectory);
        }
        let begin = usize::try_from(handle.cursor)
            .unwrap_or(usize::MAX)
            .min(entry.bytes.len());
        let end = begin.saturating_add(length).min(entry.bytes.len());
        let result = entry.bytes[begin..end].to_vec();
        handle.cursor = handle
            .cursor
            .checked_add(result.len() as u64)
            .ok_or(Error::InvalidSeek)?;
        Ok(result)
    }
    pub fn write(&mut self, fd: u32, bytes: &[u8]) -> Result<usize, Error> {
        if bytes.len() > MAX_TRANSFER_BYTES {
            return Err(Error::Quota);
        }
        let handle = self.handles.get(&fd).ok_or(Error::BadDescriptor)?;
        let entry = self.entries.get(&handle.path).ok_or(Error::NoEntry)?;
        if entry.kind != Kind::File {
            return Err(Error::IsDirectory);
        }
        if !handle.writable {
            return Err(Error::NotCapable);
        }
        if entry.readonly {
            return Err(Error::ReadOnly);
        }
        if bytes.is_empty() {
            return Ok(0);
        }
        let old_size = entry.bytes.len();
        let start = if handle.append {
            old_size
        } else {
            usize::try_from(handle.cursor).map_err(|_| Error::Quota)?
        };
        let end = start.checked_add(bytes.len()).ok_or(Error::Quota)?;
        let new_size = old_size.max(end);
        self.quota(old_size, new_size, 0)?;
        let path = handle.path.clone();
        let entry = self.entries.get_mut(&path).ok_or(Error::NoEntry)?;
        entry.bytes.resize(new_size, 0);
        entry.bytes[start..end].copy_from_slice(bytes);
        self.total_bytes = self.total_bytes - old_size + new_size;
        self.handles
            .get_mut(&fd)
            .ok_or(Error::BadDescriptor)?
            .cursor = end as u64;
        Ok(bytes.len())
    }
    pub fn seek(&mut self, fd: u32, offset: i64, whence: Whence) -> Result<u64, Error> {
        let handle = self.handles.get_mut(&fd).ok_or(Error::BadDescriptor)?;
        let entry = self.entries.get(&handle.path).ok_or(Error::NoEntry)?;
        if entry.kind != Kind::File {
            return Err(Error::IsDirectory);
        }
        let base = match whence {
            Whence::Start => 0,
            Whence::Current => handle.cursor,
            Whence::End => entry.bytes.len() as u64,
        };
        let cursor = if offset >= 0 {
            base.checked_add(offset as u64)
        } else {
            base.checked_sub(offset.unsigned_abs())
        }
        .ok_or(Error::InvalidSeek)?;
        handle.cursor = cursor;
        Ok(cursor)
    }
    pub fn tell(&self, fd: u32) -> Result<u64, Error> {
        Ok(self.handles.get(&fd).ok_or(Error::BadDescriptor)?.cursor)
    }
    pub fn resize(&mut self, fd: u32, size: u64) -> Result<(), Error> {
        let handle = self.handles.get(&fd).ok_or(Error::BadDescriptor)?;
        if !handle.writable {
            return Err(Error::NotCapable);
        }
        let entry = self.entries.get(&handle.path).ok_or(Error::NoEntry)?;
        if entry.kind != Kind::File {
            return Err(Error::IsDirectory);
        }
        if entry.readonly {
            return Err(Error::ReadOnly);
        }
        let size = usize::try_from(size).map_err(|_| Error::Quota)?;
        let old_size = entry.bytes.len();
        self.quota(old_size, size, 0)?;
        let path = handle.path.clone();
        self.entries
            .get_mut(&path)
            .ok_or(Error::NoEntry)?
            .bytes
            .resize(size, 0);
        self.total_bytes = self.total_bytes - old_size + size;
        Ok(())
    }
    pub fn mkdir(&mut self, fd: u32, path: &str) -> Result<(), Error> {
        let path = self.path(fd, path)?;
        if self.entries.contains_key(&path) {
            return Err(Error::Exists);
        }
        self.check_parent(&path)?;
        self.quota(0, 0, 1)?;
        self.entries.insert(path, Entry::directory(false));
        Ok(())
    }
    pub fn readdir(&self, fd: u32) -> Result<Vec<DirEntry>, Error> {
        let prefix = format!("{}/", self.directory(fd)?.trim_end_matches('/'));
        Ok(self
            .entries
            .iter()
            .filter_map(|(path, entry)| {
                let name = path.strip_prefix(&prefix)?;
                if name.is_empty() || name.contains('/') {
                    return None;
                }
                Some(DirEntry {
                    name: name.to_string(),
                    kind: entry.kind,
                })
            })
            .collect())
    }
    pub fn unlink(&mut self, fd: u32, path: &str, directory: bool) -> Result<(), Error> {
        let path = self.path(fd, path)?;
        if path == "/" {
            return Err(Error::NotCapable);
        }
        self.check_parent(&path)?;
        let entry = self.entries.get(&path).ok_or(Error::NoEntry)?;
        if entry.readonly {
            return Err(Error::ReadOnly);
        }
        if directory && entry.kind != Kind::Directory {
            return Err(Error::NotDirectory);
        }
        if !directory && entry.kind != Kind::File {
            return Err(Error::IsDirectory);
        }
        if directory
            && self
                .entries
                .keys()
                .any(|p| p.starts_with(&format!("{path}/")))
        {
            return Err(Error::NotEmpty);
        }
        // Deliberately reject open-file deletion. The ABI facade must close native
        // descriptors first rather than losing bytes or inventing inode semantics.
        if self.handles.values().any(|h| h.path == path) {
            return Err(Error::NotCapable);
        }
        let entry = self.entries.remove(&path).ok_or(Error::NoEntry)?;
        self.total_bytes -= entry.bytes.len();
        Ok(())
    }
    pub fn rename(&mut self, old_fd: u32, old: &str, new_fd: u32, new: &str) -> Result<(), Error> {
        let old = self.path(old_fd, old)?;
        let new = self.path(new_fd, new)?;
        if old == new {
            return self.entries.get(&old).map(|_| ()).ok_or(Error::NoEntry);
        }
        if old == "/" || new == "/" || new.starts_with(&format!("{old}/")) {
            return Err(Error::NotCapable);
        }
        self.check_parent(&old)?;
        self.check_parent(&new)?;
        let source = self.entries.get(&old).ok_or(Error::NoEntry)?;
        if source.readonly {
            return Err(Error::ReadOnly);
        }
        let prefix = format!("{old}/");
        if self
            .entries
            .iter()
            .any(|(path, e)| path.starts_with(&prefix) && e.readonly)
        {
            return Err(Error::ReadOnly);
        }
        let replaced_size = if let Some(target) = self.entries.get(&new) {
            if target.readonly {
                return Err(Error::ReadOnly);
            }
            if source.kind != target.kind {
                return Err(if source.kind == Kind::Directory {
                    Error::NotDirectory
                } else {
                    Error::IsDirectory
                });
            }
            if target.kind == Kind::Directory
                && self
                    .entries
                    .keys()
                    .any(|p| p.starts_with(&format!("{new}/")))
            {
                return Err(Error::NotEmpty);
            }
            if self.handles.values().any(|h| h.path == new) {
                return Err(Error::NotCapable);
            }
            target.bytes.len()
        } else {
            0
        };
        let moved: Vec<_> = self
            .entries
            .keys()
            .filter(|p| **p == old || p.starts_with(&prefix))
            .cloned()
            .collect();
        for path in &moved {
            if new.len() + path.len() - old.len() > MAX_PATH_BYTES {
                return Err(Error::InvalidPath);
            }
        }
        self.entries.remove(&new);
        self.total_bytes -= replaced_size;
        for path in moved {
            let entry = self.entries.remove(&path).ok_or(Error::NoEntry)?;
            self.entries
                .insert(format!("{new}{}", &path[old.len()..]), entry);
        }
        for handle in self.handles.values_mut() {
            if handle.path == old || handle.path.starts_with(&prefix) {
                handle.path = format!("{new}{}", &handle.path[old.len()..]);
            }
        }
        Ok(())
    }
    pub fn checkpoint(&self) -> Checkpoint {
        Checkpoint {
            version: 1,
            entries: self.entries.clone(),
        }
    }
    pub fn list_writable(&self) -> Vec<WritableEntry> {
        self.entries
            .iter()
            .filter(|(path, entry)| path.as_str() != "/" && !entry.readonly)
            .map(|(path, entry)| WritableEntry {
                path: path.clone(),
                stat: entry.stat(),
            })
            .collect()
    }
    pub fn fd_flags(&self, fd: u32) -> Result<Flags, Error> {
        let handle = self.handles.get(&fd).ok_or(Error::BadDescriptor)?;
        Ok(Flags {
            append: handle.append,
            writable: handle.writable,
        })
    }
    pub fn set_append(&mut self, fd: u32, append: bool) -> Result<(), Error> {
        let handle = self.handles.get_mut(&fd).ok_or(Error::BadDescriptor)?;
        if append && !handle.writable {
            return Err(Error::NotCapable);
        }
        if self
            .entries
            .get(&handle.path)
            .is_none_or(|e| e.kind != Kind::File)
        {
            return Err(Error::IsDirectory);
        }
        handle.append = append;
        Ok(())
    }
    /// Validation finishes before any state is replaced. Immutable resources must
    /// exactly match the current acquired mount; descriptor cursors are not saves.
    pub fn restore(&mut self, checkpoint: Checkpoint) -> Result<(), Error> {
        if checkpoint.version != 1 || checkpoint.entries.len() > MAX_ENTRIES {
            return Err(Error::InvalidCheckpoint);
        }
        let Some(root) = checkpoint.entries.get("/") else {
            return Err(Error::InvalidCheckpoint);
        };
        if root.kind != Kind::Directory || root.readonly || !root.bytes.is_empty() {
            return Err(Error::InvalidCheckpoint);
        }
        let current_assets: BTreeMap<_, _> =
            self.entries.iter().filter(|(_, e)| e.readonly).collect();
        let saved_assets: BTreeMap<_, _> = checkpoint
            .entries
            .iter()
            .filter(|(_, e)| e.readonly)
            .collect();
        if current_assets != saved_assets {
            return Err(Error::InvalidCheckpoint);
        }
        let mut total_bytes = 0_usize;
        for (path, entry) in &checkpoint.entries {
            if path != "/"
                && (!path.starts_with('/')
                    || resolve("/", &path[1..]).as_deref() != Ok(path.as_str()))
            {
                return Err(Error::InvalidCheckpoint);
            }
            if entry.bytes.len() > MAX_FILE_BYTES
                || (entry.kind == Kind::Directory && !entry.bytes.is_empty())
            {
                return Err(Error::InvalidCheckpoint);
            }
            total_bytes = total_bytes
                .checked_add(entry.bytes.len())
                .ok_or(Error::InvalidCheckpoint)?;
            if total_bytes > MAX_TOTAL_BYTES {
                return Err(Error::InvalidCheckpoint);
            }
            if path != "/"
                && checkpoint
                    .entries
                    .get(parent(path))
                    .is_none_or(|e| e.kind != Kind::Directory)
            {
                return Err(Error::InvalidCheckpoint);
            }
        }
        // Reject impossible writable children in a read-only resource directory.
        let asset_directories: BTreeSet<_> = checkpoint
            .entries
            .iter()
            .filter(|(_, e)| e.readonly && e.kind == Kind::Directory)
            .map(|(path, _)| path)
            .collect();
        for (path, entry) in &checkpoint.entries {
            if !entry.readonly
                && asset_directories
                    .iter()
                    .any(|dir| path.starts_with(&format!("{dir}/")))
            {
                return Err(Error::InvalidCheckpoint);
            }
        }
        self.entries = checkpoint.entries;
        self.total_bytes = total_bytes;
        self.handles = Self::new().handles;
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct WritableEntry {
    pub path: String,
    pub stat: Stat,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Flags {
    pub append: bool,
    pub writable: bool,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "op", rename_all = "snake_case", deny_unknown_fields)]
pub enum Operation {
    MountAsset {
        path: String,
        bytes: Vec<u8>,
    },
    Open {
        dir_fd: u32,
        path: String,
        flags: Open,
    },
    Close {
        fd: u32,
    },
    Read {
        fd: u32,
        length: usize,
    },
    Write {
        fd: u32,
        bytes: Vec<u8>,
    },
    Seek {
        fd: u32,
        offset: String,
        whence: Whence,
    },
    Tell {
        fd: u32,
    },
    StatPath {
        dir_fd: u32,
        path: String,
    },
    StatFd {
        fd: u32,
    },
    GetTimes {
        fd: u32,
    },
    GetPathTimes {
        dir_fd: u32,
        path: String,
    },
    SetTimes {
        fd: u32,
        atime: Option<String>,
        mtime: Option<String>,
        ctime: String,
    },
    SetPathTimes {
        dir_fd: u32,
        path: String,
        atime: Option<String>,
        mtime: Option<String>,
        ctime: String,
    },
    Resize {
        fd: u32,
        size: u64,
    },
    Mkdir {
        dir_fd: u32,
        path: String,
    },
    Readdir {
        fd: u32,
    },
    Unlink {
        dir_fd: u32,
        path: String,
        directory: bool,
    },
    Rename {
        old_fd: u32,
        old_path: String,
        new_fd: u32,
        new_path: String,
    },
    ListWritable,
    FdFlags {
        fd: u32,
    },
    SetAppend {
        fd: u32,
        append: bool,
    },
}

#[derive(Debug, Serialize)]
pub struct Response {
    pub errno: u16,
    pub value: serde_json::Value,
}

impl Error {
    /// WASI preview1 errno numbers. Unsupported operations are rejected by the
    /// import facade; none of these statuses imply host filesystem access.
    pub const fn errno(self) -> u16 {
        match self {
            Self::InvalidPath | Self::InvalidSeek | Self::InvalidTime | Self::InvalidCheckpoint => {
                28
            }
            Self::NotCapable => 76,
            Self::NoEntry => 44,
            Self::Exists => 20,
            Self::NotDirectory => 54,
            Self::IsDirectory => 31,
            Self::BadDescriptor => 8,
            Self::ReadOnly => 69,
            Self::NotEmpty => 55,
            Self::Quota => 51,
        }
    }
}

pub fn execute(fs: &mut FileSystem, operation: Operation) -> Response {
    use serde_json::json;
    let result: Result<serde_json::Value, Error> = (|| {
        Ok(match operation {
            Operation::MountAsset { path, bytes } => {
                fs.mount_asset(&path, bytes)?;
                json!(null)
            }
            Operation::Open {
                dir_fd,
                path,
                flags,
            } => json!({"fd":fs.open(dir_fd, &path, flags)?}),
            Operation::Close { fd } => {
                fs.close(fd)?;
                json!(null)
            }
            Operation::Read { fd, length } => {
                let bytes = fs.read(fd, length)?;
                json!({"count":bytes.len(),"bytes":bytes})
            }
            Operation::Write { fd, bytes } => json!({"count":fs.write(fd, &bytes)?}),
            Operation::Seek { fd, offset, whence } => {
                json!({"offset":fs.seek(fd, offset.parse().map_err(|_| Error::InvalidSeek)?, whence)?.to_string()})
            }
            Operation::Tell { fd } => json!({"offset":fs.tell(fd)?.to_string()}),
            Operation::StatPath { dir_fd, path } => json!(fs.stat_path(dir_fd, &path)?),
            Operation::StatFd { fd } => json!(fs.stat_fd(fd)?),
            Operation::GetTimes { fd } => json!(fs.get_times(fd)?),
            Operation::GetPathTimes { dir_fd, path } => {
                json!(fs.get_path_times(dir_fd, &path)?)
            }
            Operation::SetTimes {
                fd,
                atime,
                mtime,
                ctime,
            } => {
                let atime = atime.as_deref().map(canonical_timestamp).transpose()?;
                let mtime = mtime.as_deref().map(canonical_timestamp).transpose()?;
                let ctime = canonical_timestamp(&ctime)?;
                fs.set_times(fd, atime, mtime, ctime)?;
                json!(null)
            }
            Operation::SetPathTimes {
                dir_fd,
                path,
                atime,
                mtime,
                ctime,
            } => {
                let atime = atime.as_deref().map(canonical_timestamp).transpose()?;
                let mtime = mtime.as_deref().map(canonical_timestamp).transpose()?;
                let ctime = canonical_timestamp(&ctime)?;
                fs.set_path_times(dir_fd, &path, atime, mtime, ctime)?;
                json!(null)
            }
            Operation::Resize { fd, size } => {
                fs.resize(fd, size)?;
                json!(null)
            }
            Operation::Mkdir { dir_fd, path } => {
                fs.mkdir(dir_fd, &path)?;
                json!(null)
            }
            Operation::Readdir { fd } => json!(fs.readdir(fd)?),
            Operation::Unlink {
                dir_fd,
                path,
                directory,
            } => {
                fs.unlink(dir_fd, &path, directory)?;
                json!(null)
            }
            Operation::Rename {
                old_fd,
                old_path,
                new_fd,
                new_path,
            } => {
                fs.rename(old_fd, &old_path, new_fd, &new_path)?;
                json!(null)
            }
            Operation::ListWritable => json!(fs.list_writable()),
            Operation::FdFlags { fd } => json!(fs.fd_flags(fd)?),
            Operation::SetAppend { fd, append } => {
                fs.set_append(fd, append)?;
                json!(null)
            }
        })
    })();
    match result {
        Ok(value) => Response { errno: 0, value },
        Err(error) => Response {
            errno: error.errno(),
            value: serde_json::Value::Null,
        },
    }
}

#[cfg(test)]
mod timestamp_tests {
    use super::*;
    use serde_json::{Value, json};

    fn owned_file(fs: &mut FileSystem, path: &str) -> u32 {
        fs.open(
            ROOT_FD,
            path,
            Open {
                create: true,
                writable: true,
                ..Open::default()
            },
        )
        .unwrap()
    }

    fn request(fs: &mut FileSystem, value: Value) -> Response {
        execute(fs, serde_json::from_value(value).unwrap())
    }

    #[test]
    fn created_entries_and_legacy_checkpoints_default_to_zero_times() {
        let mut fs = FileSystem::new();
        let fd = owned_file(&mut fs, "new");
        fs.mkdir(ROOT_FD, "new_directory").unwrap();
        fs.mount_asset("data/core.lua", b"official".to_vec())
            .unwrap();
        assert_eq!(fs.get_times(ROOT_FD).unwrap(), FileTimes::default());
        assert_eq!(fs.get_times(fd).unwrap(), FileTimes::default());
        for path in ["new_directory", "data", "data/core.lua"] {
            assert_eq!(
                fs.get_path_times(ROOT_FD, path).unwrap(),
                FileTimes::default()
            );
        }

        let legacy = json!({
            "version": 1,
            "entries": {
                "/": {"kind":"directory", "readonly":false, "bytes":[]},
                "/save": {"kind":"file", "readonly":false, "bytes":[0,255,8]}
            }
        });
        let mut restored = FileSystem::new();
        restored
            .restore(serde_json::from_value(legacy).unwrap())
            .unwrap();
        assert_eq!(restored.get_times(ROOT_FD).unwrap(), FileTimes::default());
        assert_eq!(
            restored.get_path_times(ROOT_FD, "save").unwrap(),
            FileTimes::default()
        );
        let file = restored.open(ROOT_FD, "save", Open::default()).unwrap();
        assert_eq!(restored.read(file, 10).unwrap(), [0, 255, 8]);
    }

    #[test]
    fn max_u64_times_use_exact_decimal_strings_without_changing_stat_json() {
        let mut fs = FileSystem::new();
        let fd = owned_file(&mut fs, "save");
        fs.write(fd, b"native").unwrap();
        let max = u64::MAX.to_string();
        let response = request(
            &mut fs,
            json!({"op":"set_times", "fd":fd, "atime":max, "mtime":max, "ctime":max}),
        );
        assert_eq!(response.errno, 0);
        assert_eq!(response.value, Value::Null);
        let response = request(&mut fs, json!({"op":"get_times", "fd":fd}));
        assert_eq!(response.errno, 0);
        assert_eq!(
            response.value,
            json!({"atime":max, "mtime":max, "ctime":max})
        );
        let path_response = request(
            &mut fs,
            json!({"op":"get_path_times", "dir_fd":ROOT_FD, "path":"save"}),
        );
        assert_eq!(path_response.value, response.value);
        assert_eq!(
            serde_json::to_value(fs.stat_fd(fd).unwrap()).unwrap(),
            json!({"kind":"file", "bytes":6, "readonly":false})
        );
    }

    #[test]
    fn timestamps_roundtrip_checkpoint_clone_and_directory_rename() {
        let mut fs = FileSystem::new();
        fs.mkdir(ROOT_FD, "user").unwrap();
        let fd = owned_file(&mut fs, "user/save");
        fs.write(fd, b"unaltered bytes").unwrap();
        fs.set_times(fd, Some(u64::MAX), Some(9_007_199_254_740_993), 17)
            .unwrap();
        fs.set_path_times(ROOT_FD, "user", Some(21), Some(22), 23)
            .unwrap();
        fs.set_times(ROOT_FD, Some(31), Some(32), 33).unwrap();
        let expected = fs.get_times(fd).unwrap();
        let cloned = fs.clone();
        assert_eq!(cloned.get_times(fd).unwrap(), expected);
        fs.rename(ROOT_FD, "user", ROOT_FD, "profile").unwrap();
        assert_eq!(fs.get_times(fd).unwrap(), expected);
        assert_eq!(
            fs.get_path_times(ROOT_FD, "profile/save").unwrap(),
            expected
        );
        assert_eq!(fs.get_path_times(ROOT_FD, "user/save"), Err(Error::NoEntry));
        let encoded = serde_json::to_string(&fs.checkpoint()).unwrap();
        let mut restored = FileSystem::new();
        restored
            .restore(serde_json::from_str(&encoded).unwrap())
            .unwrap();
        assert_eq!(
            restored.get_path_times(ROOT_FD, "profile/save").unwrap(),
            expected
        );
        assert_eq!(
            restored.get_path_times(ROOT_FD, "profile").unwrap(),
            FileTimes {
                atime: 21,
                mtime: 22,
                ctime: 23
            }
        );
        assert_eq!(
            restored.get_times(ROOT_FD).unwrap(),
            fs.get_times(ROOT_FD).unwrap()
        );
        let restored_fd = restored
            .open(ROOT_FD, "profile/save", Open::default())
            .unwrap();
        assert_eq!(restored.read(restored_fd, 100).unwrap(), b"unaltered bytes");
    }

    #[test]
    fn partial_updates_on_read_only_owned_handle_preserve_bytes_and_cursor() {
        let mut fs = FileSystem::new();
        let writable = owned_file(&mut fs, "save");
        fs.write(writable, b"original").unwrap();
        fs.close(writable).unwrap();
        let fd = fs.open(ROOT_FD, "save", Open::default()).unwrap();
        fs.read(fd, 3).unwrap();
        fs.set_times(fd, Some(10), Some(20), 30).unwrap();
        let response = request(
            &mut fs,
            json!({"op":"set_times", "fd":fd, "mtime":"25", "ctime":"35"}),
        );
        assert_eq!(response.errno, 0);
        assert_eq!(
            fs.get_times(fd).unwrap(),
            FileTimes {
                atime: 10,
                mtime: 25,
                ctime: 35
            }
        );
        let response = request(
            &mut fs,
            json!({"op":"set_path_times", "dir_fd":ROOT_FD, "path":"save", "atime":"15", "mtime":null, "ctime":"40"}),
        );
        assert_eq!(response.errno, 0);
        assert_eq!(
            fs.get_times(fd).unwrap(),
            FileTimes {
                atime: 15,
                mtime: 25,
                ctime: 40
            }
        );
        assert_eq!(fs.tell(fd).unwrap(), 3);
        assert_eq!(fs.write(fd, b"changed"), Err(Error::NotCapable));
        assert_eq!(fs.read(fd, 100).unwrap(), b"ginal");
    }

    #[test]
    fn invalid_decimal_updates_are_atomic_for_every_timestamp_and_target_form() {
        let mut fs = FileSystem::new();
        let fd = owned_file(&mut fs, "save");
        fs.write(fd, b"native save").unwrap();
        fs.set_times(fd, Some(1), Some(2), 3).unwrap();
        let before = serde_json::to_value(fs.checkpoint()).unwrap();
        let invalid = [
            "",
            "00",
            "01",
            "+1",
            "-1",
            " 1",
            "1 ",
            "1.0",
            "1e3",
            "１",
            "18446744073709551616",
        ];
        for field in ["atime", "mtime", "ctime"] {
            for value in invalid {
                for operation in ["set_times", "set_path_times"] {
                    let mut update = if operation == "set_times" {
                        json!({"op":operation, "fd":fd, "atime":"4", "mtime":"5", "ctime":"6"})
                    } else {
                        json!({"op":operation, "dir_fd":ROOT_FD, "path":"save", "atime":"4", "mtime":"5", "ctime":"6"})
                    };
                    update[field] = json!(value);
                    let response = request(&mut fs, update);
                    assert_eq!(response.errno, 28, "{operation} {field}={value:?}");
                    assert_eq!(response.value, Value::Null);
                    assert_eq!(serde_json::to_value(fs.checkpoint()).unwrap(), before);
                    assert_eq!(fs.tell(fd).unwrap(), 11);
                }
            }
        }
    }

    #[test]
    fn mounted_assets_and_their_directories_reject_metadata_changes_atomically() {
        let mut fs = FileSystem::new();
        fs.mount_asset("data/core.lua", b"official".to_vec())
            .unwrap();
        let fd = fs.open(ROOT_FD, "data/core.lua", Open::default()).unwrap();
        let before = serde_json::to_value(fs.checkpoint()).unwrap();
        assert_eq!(fs.set_times(fd, Some(1), Some(2), 3), Err(Error::ReadOnly));
        for path in ["data/core.lua", "data"] {
            assert_eq!(
                fs.set_path_times(ROOT_FD, path, Some(1), Some(2), 3),
                Err(Error::ReadOnly)
            );
        }
        let response = request(
            &mut fs,
            json!({"op":"set_times", "fd":fd, "atime":"1", "mtime":"2", "ctime":"3"}),
        );
        assert_eq!(response.errno, 69);
        assert_eq!(serde_json::to_value(fs.checkpoint()).unwrap(), before);
        assert_eq!(fs.get_times(fd).unwrap(), FileTimes::default());
    }

    #[test]
    fn missing_closed_and_confined_targets_reject_without_mutation() {
        let mut fs = FileSystem::new();
        fs.mkdir(ROOT_FD, "user").unwrap();
        let fd = owned_file(&mut fs, "user/save");
        fs.set_times(fd, Some(1), Some(2), 3).unwrap();
        let dir_fd = fs
            .open(
                ROOT_FD,
                "user",
                Open {
                    directory: true,
                    ..Open::default()
                },
            )
            .unwrap();
        assert_eq!(
            fs.set_path_times(fd, ".", Some(4), Some(5), 6),
            Err(Error::NotDirectory)
        );
        assert_eq!(
            fs.set_path_times(dir_fd, "../escape", Some(4), Some(5), 6),
            Err(Error::NotCapable)
        );
        fs.close(fd).unwrap();
        let before = serde_json::to_value(fs.checkpoint()).unwrap();
        assert_eq!(fs.get_times(fd), Err(Error::BadDescriptor));
        assert_eq!(
            fs.set_times(fd, Some(4), Some(5), 6),
            Err(Error::BadDescriptor)
        );
        assert_eq!(fs.get_path_times(dir_fd, "missing"), Err(Error::NoEntry));
        assert_eq!(
            fs.set_path_times(dir_fd, "missing", Some(4), Some(5), 6),
            Err(Error::NoEntry)
        );
        let closed = request(&mut fs, json!({"op":"set_times", "fd":fd, "ctime":"6"}));
        assert_eq!(closed.errno, 8);
        let missing = request(
            &mut fs,
            json!({"op":"set_path_times", "dir_fd":dir_fd, "path":"missing", "ctime":"6"}),
        );
        assert_eq!(missing.errno, 44);
        assert_eq!(serde_json::to_value(fs.checkpoint()).unwrap(), before);
    }

    #[test]
    fn serialized_times_reject_numeric_incomplete_and_noncanonical_metadata() {
        for invalid in [
            json!({"atime":0, "mtime":"0", "ctime":"0"}),
            json!({"atime":"0", "mtime":"0"}),
            json!({"atime":"0", "mtime":"0", "ctime":"0", "extra":"0"}),
            json!({"atime":"00", "mtime":"0", "ctime":"0"}),
            json!({"atime":"0", "mtime":"18446744073709551616", "ctime":"0"}),
        ] {
            assert!(serde_json::from_value::<FileTimes>(invalid).is_err());
        }
        assert!(
            serde_json::from_value::<Operation>(json!({
                "op":"set_times", "fd":4, "atime":0, "ctime":"0"
            }))
            .is_err()
        );
    }

    #[test]
    fn forged_asset_times_fail_checkpoint_restore_atomically() {
        let mut fs = FileSystem::new();
        fs.mount_asset("core.lua", b"official".to_vec()).unwrap();
        let fd = owned_file(&mut fs, "save");
        fs.set_times(fd, Some(1), Some(2), 3).unwrap();
        let before = serde_json::to_value(fs.checkpoint()).unwrap();
        let mut forged = before.clone();
        forged["entries"]["/core.lua"]["times"]["atime"] = json!("1");
        assert_eq!(
            fs.restore(serde_json::from_value(forged).unwrap()),
            Err(Error::InvalidCheckpoint)
        );
        assert_eq!(serde_json::to_value(fs.checkpoint()).unwrap(), before);
        assert_eq!(fs.get_times(fd).unwrap().ctime, 3);
    }
}
