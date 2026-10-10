/* Browser-owned sequential save worker. GPL-3.0-or-later.
 * This replaces scheduling only; graph serialization remains upstream code.
 * No completion name is posted until ZIP close and final rename succeed.
 */
static int browser_save_fail(const char *operation, const char *name, int code)
{
	if (!browser_save.error) {
		browser_save.error = 1;
		snprintf(browser_save.message, sizeof(browser_save.message),
			"%s failed for %s (code %d)", operation, name ? name : "(none)", code);
	}
	return -1;
}

static int browser_save_physfs_fail(const char *operation, const char *name)
{
	const char *detail = PHYSFS_getLastError();
	if (!browser_save.error) {
		browser_save.error = 1;
		snprintf(browser_save.message, sizeof(browser_save.message),
			"%s failed for %s: %s", operation, name ? name : "(none)",
			detail ? detail : "PhysFS returned failure without a message");
	}
	return -1;
}

static int browser_save_finish_zip(const char *zipname)
{
	size_t len = strlen(zipname);
	if (len >= 4 && strcmp(zipname + len - 4, ".tmp") == 0) {
		char *newname = strdup(zipname);
		if (!newname) return browser_save_fail("allocate final save name", zipname, ZIP_INTERNALERROR);
		newname[len - 4] = '\0';
		if (PHYSFS_exists(newname) && !PHYSFS_delete(newname)) {
			browser_save_physfs_fail("delete previous save", newname);
			free(newname);
			return -1;
		}
		if (!PHYSFS_rename(zipname, newname)) {
			browser_save_physfs_fail("rename completed save", zipname);
			free(newname);
			return -1;
		}
		push_save_return(newname);
		free(newname);
	} else {
		push_save_return(zipname);
	}
	return browser_save.error ? -1 : 0;
}

/* Retain the externally visible upstream symbol with checked semantics. */
void finish_zip(const char *zipname)
{
	(void)browser_save_finish_zip(zipname);
}

static int browser_save_close_archive(void)
{
	zipFile *zf = browser_save.archive;
	char *name = browser_save.archive_name;
	int err;
	if (!zf) return 0;
	browser_save.archive = NULL;
	browser_save.archive_name = NULL;
	err = zipClose(zf, NULL);
	if (err != ZIP_OK) {
		browser_save_fail("zipClose", name, err);
		free(name);
		return -1;
	}
	printf("Saved zipname %s\n", name);
	err = browser_save_finish_zip(name);
	free(name);
	return err;
}

static int browser_save_begin_entry(save_queue *q)
{
	zipFile *zf = browser_save.archive;
	/* BEGIN EXACT UPSTREAM ZIP ENTRY METADATA/COMPRESSION BLOCK */
@UPSTREAM_ENTRY_OPEN@
	/* END EXACT UPSTREAM ZIP ENTRY METADATA/COMPRESSION BLOCK */
	if (err != ZIP_OK) return browser_save_fail("zipOpenNewFileInZip3", q->filename, err);
	browser_save.entry_open = 1;
	return 0;
}

int tome_browser_serial_worker_ready(void)
{
	return main_save != NULL && !browser_save.error;
}

/* queued_entries excludes the current entry; completion names are not work.
 * A zero budget never starts, writes, closes, renames, or consumes anything.
 */
int tome_browser_serial_pump(unsigned max_entries, unsigned max_bytes)
{
	unsigned completed = 0;
	size_t written = 0;
	if (browser_save.error) return -1;
	if (!main_save) return browser_save_fail("save worker initialization", NULL, ZIP_INTERNALERROR);
	if (!browser_save.activated || !max_entries || !max_bytes)
		return (browser_save.queued_entries || browser_save.entry || browser_save.archive || browser_save.activated) ? 1 : 0;
	while (completed < max_entries && written < max_bytes) {
		if (!browser_save.entry) {
			save_queue *q = main_save->iqueue_head;
			if (!q) {
				if (browser_save_close_archive() < 0) return -1;
				if (last_zipname) free(last_zipname);
				last_zipname = NULL;
				last_zf = NULL;
				browser_save.activated = 0;
				return 0;
			}
			if (browser_save.archive && strcmp(browser_save.archive_name, q->zfname)) {
				if (browser_save_close_archive() < 0) return -1;
			}
			q = pop_save();
			--browser_save.queued_entries;
			browser_save.entry = q;
			browser_save.offset = 0;
			if (!browser_save.archive) {
				if (!q->zf) return browser_save_fail("zipOpen", q->zfname, ZIP_ERRNO);
				browser_save.archive = q->zf;
				browser_save.archive_name = strdup(q->zfname);
				if (!browser_save.archive_name)
					return browser_save_fail("allocate active archive name", q->zfname, ZIP_INTERNALERROR);
				printf("Saving zipname %s\n", q->zfname);
			}
			if (browser_save_begin_entry(q) < 0) return -1;
		}
		{
			save_queue *q = browser_save.entry;
			size_t remaining = q->payload_len - browser_save.offset;
			if (remaining) {
				size_t chunk = remaining;
				int err;
				if (chunk > max_bytes - written) chunk = max_bytes - written;
				if (chunk > 65536) chunk = 65536;
				err = zipWriteInFileInZip(browser_save.archive,
					q->payload + browser_save.offset, (unsigned)chunk);
				if (err != ZIP_OK) return browser_save_fail("zipWriteInFileInZip", q->filename, err);
				browser_save.offset += chunk;
				written += chunk;
				browser_save.payload_bytes_written += chunk;
			}
			if (browser_save.offset == q->payload_len) {
				int err = zipCloseFileInZip(browser_save.archive);
				if (err != ZIP_OK) return browser_save_fail("zipCloseFileInZip", q->filename, err);
				browser_save.entry_open = 0;
				free(q->payload);
				free(q->zfname);
				free(q->filename);
				free(q);
				browser_save.entry = NULL;
				browser_save.offset = 0;
				++browser_save.entries_written;
				++completed;
			}
		}
	}
	return 1;
}

const char *tome_browser_serial_error(void)
{
	return browser_save.error ? browser_save.message : NULL;
}

/* Keep the upstream initializer name for luaopen_serial, but allocate no
 * SDL thread, mutex, or semaphore. This queue has one browser owner. */
void create_save_thread(void)
{
	if (main_save) return;
	main_save = calloc(1, sizeof(save_type));
	if (!main_save) {
		browser_save_fail("allocate save queue", NULL, ZIP_INTERNALERROR);
		return;
	}
	main_save->running = TRUE;
	printf("Creating browser sequential save queue\n");
}
