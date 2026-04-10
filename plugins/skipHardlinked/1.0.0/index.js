const details = () => ({
  name: 'Skip Hardlinked Files',
  description: 'Skips files with more than 1 hardlink (torrent-sourced files still seeding). Only processes files with 1 hardlink (usenet-sourced files).',
  style: {
    border: '#22c55e',
  },
  tags: 'filter,hardlink,torrent,usenet',
  isStartPlugin: false,
  pType: 'filter',
  requiresVersion: '2.11.01',
  sideEffectsOnly: false,
  inputs: [],
  outputs: [
    {
      number: 1,
      tooltip: 'Continue processing - file has 1 hardlink (usenet-sourced, safe to transcode)',
    },
    {
      number: 2,
      tooltip: 'Skip - file has 2+ hardlinks (torrent-sourced, still seeding)',
    },
  ],
});

const plugin = async (args) => {
  const lib = require('../../../../../methods/lib')();
  const { inputs, inputFileObj, jobLog } = args;

  lib.loadDefaultValues(inputs, details);

  const fs = require('fs');
  const filePath = inputFileObj._id;

  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch (err) {
    jobLog(`⚠️ Could not stat file: ${err.message}. Skipping to be safe.`);
    return {
      outputFileObj: inputFileObj,
      outputNumber: 2,
      variables: args.variables,
    };
  }

  const hardlinkCount = stat.nlink;

  if (hardlinkCount > 1) {
    jobLog(`⏭️ Skipping: file has ${hardlinkCount} hardlinks. Torrent-sourced file still seeding in qBittorrent.`);
    return {
      outputFileObj: inputFileObj,
      outputNumber: 2,
      variables: args.variables,
    };
  }

  jobLog(`✅ Processing: file has 1 hardlink. Usenet-sourced file, safe to transcode.`);
  return {
    outputFileObj: inputFileObj,
    outputNumber: 1,
    variables: args.variables,
  };
};

module.exports.details = details;
module.exports.plugin = plugin;
