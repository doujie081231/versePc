/**
 * @module @xmcl/unzip
 */
import { Readable } from 'stream';
import { Entry, ZipFile, ZipFileOptions, Options } from '@xmcl/yauzl';
export type OpenTarget = string | Buffer | number;
/**
 * Open a yauzl zip
 * @param target The zip path or buffer or file descriptor
 * @param options The option to open
 */
export declare function open(target: OpenTarget, options?: Options): Promise<ZipFile>;
/**
 * Open the entry readstream for the zip file
 * @param zip The zip file object
 * @param entry The entry to open
 * @param options The options to open stream
 */
export declare function openEntryReadStream(zip: ZipFile, entry: Entry, options?: ZipFileOptions): Promise<Readable>;
/**
 * Read the entry to buffer
 * @param zip The zip file object
 * @param entry The entry to open
 * @param options The options to open stream
 */
export declare function readEntry(zip: ZipFile, entry: Entry, options?: ZipFileOptions): Promise<Buffer<ArrayBuffer>>;
/**
 * Read an entry into a single `Buffer` using a positional read plus a
 * synchronous inflate, avoiding the per-entry `ReadStream` + zlib `Transform`
 * pipeline that {@link readEntry} sets up. For the common case of many small
 * entries (block textures, models, lang files) this is several times faster.
 *
 * Positional reads do not share a file cursor, so concurrent calls on the same
 * `zip` are safe. Falls back to the streaming {@link readEntry} for encrypted
 * entries or compression methods other than store/deflate.
 *
 * @param zip The zip file object
 * @param entry The entry to read
 */
export declare function readEntryBuffered(zip: ZipFile, entry: Entry): Promise<Buffer>;
/**
 * Get the async entry generator for the zip file
 * @param zip The zip file
 */
export declare function walkEntriesGenerator(zip: ZipFile): AsyncGenerator<Entry, void, boolean | undefined>;
/**
 * Walk all the entries of the zip and once provided entries are all found, then terminate the walk process
 * @param zip The zip file
 * @param entries The entry to read
 */
export declare function filterEntries(zip: ZipFile, entries: Array<string | ((entry: Entry) => boolean)>): Promise<(Entry | undefined)[]>;
/**
 * Walk all the entries of a unread zip file
 * @param zip The unread zip file
 * @param entryHandler The handler to recieve entries. Return true or Promise<true> to stop the walk
 */
export declare function walkEntries(zip: ZipFile, entryHandler: (entry: Entry) => Promise<boolean> | boolean | void): Promise<void>;
export declare function getEntriesRecord(entries: Entry[]): Record<string, Entry>;
/**
 * Walk all entries of the zip file
 * @param zipFile The zip file object
 */
export declare function readAllEntries(zipFile: ZipFile): Promise<Entry[]>;
//# sourceMappingURL=index.d.ts.map