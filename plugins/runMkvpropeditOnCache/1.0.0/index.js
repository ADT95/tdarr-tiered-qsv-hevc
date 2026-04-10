"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.plugin = exports.details = void 0;

/* eslint-disable no-await-in-loop */
const fs_1 = require("fs");
const path_1 = require("path");
const child_process_1 = require("child_process");

const details = () => ({
    name: 'Run mkvpropedit on Cache Copy',
    description: 'Copies the working file to the transcode cache (if not already there) '
        + 'and runs mkvpropedit --add-track-statistics-tags on the cache copy. '
        + 'This populates per-stream BPS/DURATION/NUMBER_OF_FRAMES tags that '
        + 'older mkvmerge versions did not write, which the Boosh QSV plugin '
        + 'requires for bitrate calculations. The original source file on disk '
        + 'is NEVER modified, so torrent hashes remain intact.',
    style: {
        borderColor: '#6efefc',
    },
    tags: 'video,mkv,metadata',
    isStartPlugin: false,
    pType: '',
    requiresVersion: '2.11.01',
    sidebarPosition: -1,
    icon: 'faTags',
    inputs: [
        {
            label: 'mkvpropedit Path',
            name: 'mkvpropeditPath',
            type: 'string',
            defaultValue: 'mkvpropedit',
            inputUI: {
                type: 'text',
            },
            tooltip: 'Path to the mkvpropedit binary. Default is "mkvpropedit" '
                + '(must be on PATH inside the Tdarr node container).',
        },
    ],
    outputs: [
        {
            number: 1,
            tooltip: 'mkvpropedit ran successfully (or file was not an MKV and was skipped).',
        },
        {
            number: 2,
            tooltip: 'mkvpropedit failed - file may be corrupt or unreadable.',
        },
    ],
});
exports.details = details;

const plugin = (args) => __awaiter(void 0, void 0, void 0, function* () {
    const lib = require('../../../../../methods/lib')();
    args.inputs = lib.loadDefaultValues(args.inputs, details);

    const mkvpropeditPath = String(args.inputs.mkvpropeditPath || 'mkvpropedit');

    const sourceFilePath = args.inputFileObj._id;
    const container = args.inputFileObj.container;

    // Only operate on MKV files
    if (container !== 'mkv') {
        args.jobLog(`☑ File is not an MKV (container: ${container}), skipping mkvpropedit.`);
        return {
            outputFileObj: args.inputFileObj,
            outputNumber: 1,
            variables: args.variables,
        };
    }

    // Determine if file is already in the cache (workDir) or still on the source
    const workDir = args.workDir;
    const fileName = path_1.basename(sourceFilePath);
    let workingFilePath = sourceFilePath;
    const isInWorkDir = sourceFilePath.startsWith(workDir);

    if (!isInWorkDir) {
        // File is still on the source. Copy it to the workDir first.
        // This ensures we NEVER touch the original file on /mnt/media,
        // which would break torrent hashes.
        const cachedPath = path_1.join(workDir, fileName);
        args.jobLog(`Copying source file to cache before running mkvpropedit: ${cachedPath}`);

        try {
            // Use streaming copy for memory efficiency on large files
            yield new Promise((resolve, reject) => {
                const readStream = fs_1.createReadStream(sourceFilePath);
                const writeStream = fs_1.createWriteStream(cachedPath);
                readStream.on('error', reject);
                writeStream.on('error', reject);
                writeStream.on('finish', resolve);
                readStream.pipe(writeStream);
            });
            workingFilePath = cachedPath;
            args.jobLog(`✅ Copy to cache complete.`);
        } catch (err) {
            args.jobLog(`❌ Failed to copy source to cache: ${err.message}`);
            return {
                outputFileObj: args.inputFileObj,
                outputNumber: 2,
                variables: args.variables,
            };
        }
    } else {
        args.jobLog(`File is already in workDir, running mkvpropedit on cached copy in place.`);
    }

    // Run mkvpropedit --add-track-statistics-tags on the cache copy.
    // This rewrites the MKV header with per-stream BPS/DURATION/NUMBER_OF_FRAMES
    // tags by walking the file. It does NOT touch any stream data.
    args.jobLog(`Running: ${mkvpropeditPath} --add-track-statistics-tags "${workingFilePath}"`);

    const result = yield new Promise((resolve) => {
        const proc = child_process_1.spawn(mkvpropeditPath, [
            '--add-track-statistics-tags',
            workingFilePath,
        ]);

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        proc.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        proc.on('close', (code) => {
            resolve({ code, stdout, stderr });
        });

        proc.on('error', (err) => {
            resolve({ code: -1, stdout: '', stderr: err.message });
        });
    });

    if (result.code !== 0) {
        args.jobLog(`❌ mkvpropedit failed with exit code ${result.code}`);
        if (result.stdout) args.jobLog(`stdout: ${result.stdout}`);
        if (result.stderr) args.jobLog(`stderr: ${result.stderr}`);
        return {
            outputFileObj: { _id: workingFilePath },
            outputNumber: 2,
            variables: args.variables,
        };
    }

    args.jobLog(`✅ mkvpropedit completed successfully. Per-stream stats tags written.`);
    if (result.stdout) args.jobLog(result.stdout.trim());

    // Force a re-scan of the file so subsequent plugins see the new metadata
    args.updateWorker({
        preset: '',
        container: '.mkv',
        handBrakeMode: false,
        FFmpegMode: true,
        reQueueAfter: false,
        infoLog: '✅ Per-stream stats tags written via mkvpropedit.\n',
    });

    return {
        outputFileObj: { _id: workingFilePath },
        outputNumber: 1,
        variables: args.variables,
    };
});
exports.plugin = plugin;

// Standard async wrapper used by Tdarr local flow plugins
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : Promise.resolve(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
