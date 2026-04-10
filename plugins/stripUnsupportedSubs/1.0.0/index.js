const details = () => ({
  name: 'Strip Unsupported Subtitle Codecs',
  description:
    'Removes subtitle streams with codecs that are unsupported or problematic in MKV containers '
    + '(e.g. WebVTT/S_TEXT/WEBVTT, unknown codecs). Prevents downstream ffmpeg failures. '
    + 'Output 1: file was modified (bad subs removed). Output 2: file is clean, no action needed.',
  style: {
    border: '#f59e0b',
  },
  tags: 'subtitle,ffmpeg,mkv,filter',
  isStartPlugin: false,
  pType: '',
  requiresVersion: '2.11.01',
  sideEffectsOnly: false,
  inputs: [
    {
      label: 'Unsupported Codecs',
      name: 'unsupported_codecs',
      type: 'string',
      defaultValue: 'webvtt,unknown,none',
      inputUI: {
        type: 'text',
      },
      tooltip:
        'Comma-separated list of subtitle codec names to strip. '
        + 'Matched against ffProbeData codec_name values (lowercase). '
        + '"unknown" and "none" catch streams where ffmpeg cannot identify the codec. '
        + 'Default: webvtt,unknown,none',
    },
  ],
  outputs: [
    {
      number: 1,
      tooltip: 'File was processed - unsupported subtitle streams were removed',
    },
    {
      number: 2,
      tooltip: 'File is clean - no unsupported subtitle codecs found',
    },
  ],
});

const plugin = async (args) => {
  const lib = require('../../../../../methods/lib')();
  const { inputs, inputFileObj, jobLog } = args;

  lib.loadDefaultValues(inputs, details);

  const unsupportedCodecs = (inputs.unsupported_codecs || 'webvtt,unknown,none')
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .filter((c) => c.length > 0);

  const streams = inputFileObj.ffProbeData?.streams || [];

  if (streams.length === 0) {
    jobLog('☑ No stream data found, skipping.');
    return {
      outputFileObj: inputFileObj,
      outputNumber: 2,
      variables: args.variables,
    };
  }

  const badStreams = [];
  let totalSubStreams = 0;

  for (let i = 0; i < streams.length; i += 1) {
    const stream = streams[i];
    if (stream.codec_type === 'subtitle') {
      totalSubStreams += 1;
      const codecName = (stream.codec_name || 'unknown').toLowerCase();

      if (
        unsupportedCodecs.includes(codecName)
        || codecName === ''
        || codecName === 'null'
        || codecName === 'undefined'
      ) {
        const lang = (stream.tags && stream.tags.language) || 'und';
        badStreams.push({ index: stream.index, codec: codecName, lang });
        jobLog(`☒ Found unsupported subtitle: stream ${stream.index} (codec: ${codecName}, lang: ${lang})`);
      }
    }
  }

  if (badStreams.length === 0) {
    jobLog(`☑ ${totalSubStreams} subtitle stream(s) found, all codecs supported.`);
    return {
      outputFileObj: inputFileObj,
      outputNumber: 2,
      variables: args.variables,
    };
  }

  const kept = totalSubStreams - badStreams.length;
  jobLog(`☑ Removing ${badStreams.length} unsupported subtitle stream(s), keeping ${kept}.`);

  const path = require('path');
  const childProcess = require('child_process');

  const outputFilePath = `${args.workDir}/${path.basename(inputFileObj._id)}`;

  const cliArgs = [
    '-y',
    '-i', inputFileObj._id,
    '-map', '0',
  ];

  for (let i = 0; i < badStreams.length; i += 1) {
    cliArgs.push('-map', `-0:${badStreams[i].index}`);
  }

  cliArgs.push('-c', 'copy', '-max_muxing_queue_size', '9999', outputFilePath);

  const ffmpegPath = args.ffmpegPath || 'ffmpeg';
  jobLog(`Running: ${ffmpegPath} ${cliArgs.join(' ')}`);

  const exitCode = await new Promise((resolve) => {
    const child = childProcess.spawn(ffmpegPath, cliArgs);

    child.stdout.on('data', (data) => {
      jobLog(data.toString());
    });

    child.stderr.on('data', () => {
      // ffmpeg outputs progress to stderr - suppress to avoid log spam
    });

    child.on('error', (err) => {
      jobLog(`☒ Failed to start ffmpeg: ${err.message}`);
      resolve(1);
    });

    child.on('close', (code) => {
      resolve(code);
    });
  });

  if (exitCode !== 0) {
    jobLog(`☒ FFmpeg exited with code ${exitCode}. File will not be modified.`);
    return {
      outputFileObj: inputFileObj,
      outputNumber: 2,
      variables: args.variables,
    };
  }

  jobLog('☑ Unsupported subtitle streams removed successfully.');
  return {
    outputFileObj: {
      ...inputFileObj,
      _id: outputFilePath,
    },
    outputNumber: 1,
    variables: args.variables,
  };
};

module.exports.details = details;
module.exports.plugin = plugin;
