use drl_web_port::platform::vfs::{Error, FileSystem, Kind, MAX_FILE_BYTES, Open, ROOT_FD, Whence};

fn writable() -> Open {
    Open {
        create: true,
        writable: true,
        ..Open::default()
    }
}

#[test]
fn acquired_resources_are_immutable_and_have_exact_bytes() {
    let mut fs = FileSystem::new();
    fs.mount_asset("data/drl/main.lua", b"return 42".to_vec())
        .unwrap();
    let fd = fs
        .open(ROOT_FD, "data/drl/main.lua", Open::default())
        .unwrap();
    assert_eq!(fs.read(fd, 50).unwrap(), b"return 42");
    assert_eq!(
        fs.open(ROOT_FD, "data/drl/main.lua", writable()),
        Err(Error::ReadOnly)
    );
    assert_eq!(
        fs.open(ROOT_FD, "data/drl/inject.lua", writable()),
        Err(Error::ReadOnly)
    );
    assert_eq!(
        fs.rename(ROOT_FD, "data", ROOT_FD, "moved"),
        Err(Error::ReadOnly)
    );
}

#[test]
fn file_access_is_confined_to_opened_directory() {
    let mut fs = FileSystem::new();
    fs.mkdir(ROOT_FD, "user").unwrap();
    let dir = fs
        .open(
            ROOT_FD,
            "user",
            Open {
                directory: true,
                ..Open::default()
            },
        )
        .unwrap();
    for path in ["../settings.lua", "/settings.lua", "a/../../settings.lua"] {
        assert_eq!(fs.open(dir, path, writable()), Err(Error::NotCapable));
    }
    for path in ["C:\\host.txt", "a\0b", ""] {
        assert_eq!(fs.open(dir, path, writable()), Err(Error::InvalidPath));
    }
    let fd = fs.open(dir, "./save", writable()).unwrap();
    fs.write(fd, b"native save bytes").unwrap();
    assert_eq!(fs.stat_path(ROOT_FD, "user/save").unwrap().bytes, 17);
}

#[test]
fn native_stream_seek_and_sparse_write_are_exact() {
    let mut fs = FileSystem::new();
    let fd = fs.open(ROOT_FD, "save", writable()).unwrap();
    fs.write(fd, &[1, 2, 3]).unwrap();
    fs.seek(fd, 5, Whence::Start).unwrap();
    fs.write(fd, &[8]).unwrap();
    fs.seek(fd, -6, Whence::End).unwrap();
    assert_eq!(fs.read(fd, 20).unwrap(), [1, 2, 3, 0, 0, 8]);
    assert_eq!(fs.tell(fd).unwrap(), 6);
    assert_eq!(fs.seek(fd, -7, Whence::End), Err(Error::InvalidSeek));
    assert_eq!(fs.tell(fd).unwrap(), 6);
}

#[test]
fn append_uses_current_file_end_across_multiple_handles() {
    let mut fs = FileSystem::new();
    let a = fs
        .open(
            ROOT_FD,
            "log",
            Open {
                append: true,
                ..writable()
            },
        )
        .unwrap();
    let b = fs
        .open(
            ROOT_FD,
            "log",
            Open {
                append: true,
                writable: true,
                ..Open::default()
            },
        )
        .unwrap();
    fs.write(a, b"a").unwrap();
    fs.seek(b, 0, Whence::Start).unwrap();
    fs.write(b, b"b").unwrap();
    fs.write(a, b"c").unwrap();
    fs.seek(a, 0, Whence::Start).unwrap();
    assert_eq!(fs.read(a, 3).unwrap(), b"abc");
}

#[test]
fn failed_write_and_resize_leave_bytes_cursor_and_checkpoint_unchanged() {
    let mut fs = FileSystem::new();
    let fd = fs.open(ROOT_FD, "save", writable()).unwrap();
    fs.write(fd, &[1, 2]).unwrap();
    fs.seek(fd, MAX_FILE_BYTES as i64, Whence::Start).unwrap();
    let before = serde_json::to_vec(&fs.checkpoint()).unwrap();
    assert_eq!(fs.write(fd, &[3]), Err(Error::Quota));
    assert_eq!(
        fs.resize(fd, (MAX_FILE_BYTES + 1) as u64),
        Err(Error::Quota)
    );
    assert_eq!(serde_json::to_vec(&fs.checkpoint()).unwrap(), before);
    assert_eq!(fs.tell(fd).unwrap(), MAX_FILE_BYTES as u64);
}

#[test]
fn directory_rename_retains_open_stream_and_overwrite_semantics() {
    let mut fs = FileSystem::new();
    fs.mkdir(ROOT_FD, "user").unwrap();
    let file = fs.open(ROOT_FD, "user/save", writable()).unwrap();
    fs.write(file, b"unchanged").unwrap();
    fs.rename(ROOT_FD, "user", ROOT_FD, "profile").unwrap();
    fs.seek(file, 0, Whence::Start).unwrap();
    assert_eq!(fs.read(file, 50).unwrap(), b"unchanged");
    assert_eq!(fs.stat_path(ROOT_FD, "user"), Err(Error::NoEntry));
    assert_eq!(fs.stat_path(ROOT_FD, "profile/save").unwrap().bytes, 9);
    assert_eq!(
        fs.rename(ROOT_FD, "profile", ROOT_FD, "profile/nested"),
        Err(Error::NotCapable)
    );
}

#[test]
fn directory_enumeration_is_sorted_and_cannot_delete_nonempty_or_open_files() {
    let mut fs = FileSystem::new();
    fs.mkdir(ROOT_FD, "user").unwrap();
    let dir = fs
        .open(
            ROOT_FD,
            "user",
            Open {
                directory: true,
                ..Open::default()
            },
        )
        .unwrap();
    let z = fs.open(dir, "z", writable()).unwrap();
    let a = fs.open(dir, "a", writable()).unwrap();
    assert_eq!(
        fs.readdir(dir)
            .unwrap()
            .iter()
            .map(|e| e.name.as_str())
            .collect::<Vec<_>>(),
        ["a", "z"]
    );
    assert_eq!(fs.unlink(ROOT_FD, "user", true), Err(Error::NotEmpty));
    assert_eq!(fs.unlink(dir, "a", false), Err(Error::NotCapable));
    fs.close(a).unwrap();
    fs.unlink(dir, "a", false).unwrap();
    fs.close(z).unwrap();
    fs.unlink(dir, "z", false).unwrap();
    fs.close(dir).unwrap();
    fs.unlink(ROOT_FD, "user", true).unwrap();
    assert!(fs.readdir(ROOT_FD).unwrap().is_empty());
}

#[test]
fn filesystem_checkpoint_preserves_native_bytes_with_pinned_asset_validation() {
    let mut fs = FileSystem::new();
    fs.mount_asset("core.lua", b"official".to_vec()).unwrap();
    let fd = fs.open(ROOT_FD, "save", writable()).unwrap();
    fs.write(fd, &[0, 255, 8, 17]).unwrap();
    let checkpoint = serde_json::to_vec(&fs.checkpoint()).unwrap();
    let mut fresh = FileSystem::new();
    fresh.mount_asset("core.lua", b"official".to_vec()).unwrap();
    fresh
        .restore(serde_json::from_slice(&checkpoint).unwrap())
        .unwrap();
    let fd = fresh.open(ROOT_FD, "save", Open::default()).unwrap();
    assert_eq!(fresh.read(fd, 10).unwrap(), [0, 255, 8, 17]);
    let mut wrong = FileSystem::new();
    wrong
        .mount_asset("core.lua", b"different".to_vec())
        .unwrap();
    assert_eq!(
        wrong.restore(serde_json::from_slice(&checkpoint).unwrap()),
        Err(Error::InvalidCheckpoint)
    );
}

#[test]
fn corrupt_restore_is_atomic_and_invalid_paths_never_panic() {
    let mut fs = FileSystem::new();
    let before = serde_json::to_value(fs.checkpoint()).unwrap();
    for path in ["", "../outside", "/double//slash", "relative", "/😀"] {
        let mut broken = before.clone();
        broken["entries"][path] = serde_json::json!({"kind":"file","readonly":false,"bytes":[]});
        let restored = serde_json::from_value(broken).unwrap();
        if path == "/😀" {
            fs.restore(restored).unwrap();
            continue;
        }
        assert_eq!(fs.restore(restored), Err(Error::InvalidCheckpoint));
        assert_eq!(serde_json::to_value(fs.checkpoint()).unwrap(), before);
    }
    assert_eq!(fs.stat_path(ROOT_FD, "😀").unwrap().kind, Kind::File);
}
