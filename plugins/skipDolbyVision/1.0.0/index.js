const details = () => ({
  name: 'Skip Dolby Vision Files',
  description: 'Skips files with Dolby Vision metadata to prevent playback issues from re-encoding. Files without DV continue processing normally.',
  style: {
    border: '#8b5cf6',
  },
  tags: 'filter,dolby,vision,dv,hdr',
  isStartPlugin: false,
  pType: 'filter',
  requiresVersion: '2.11.01',
  sideEffectsOnly: false,
  inputs: [],
  outputs: [
    {
      number: 1,
      tooltip: 'Continue processing - file does not contain Dolby Vision',
    },
    {
      number: 2,
      tooltip: 'Skip - file contains Dolby Vision metadata',
    },
  ],
});

const plugin = async (args) => {
  const lib = require('../../../../../methods/lib')();
  const { inputs, inputFileObj, jobLog } = args;
  lib.loadDefaultValues(inputs, details);

  const streams = inputFileObj.ffProbeData?.streams || [];
  let hasDV = false;

  for (const stream of streams) {
    if (stream.codec_type !== 'video') continue;

    // Check side_data_list for Dolby Vision configuration
    if (stream.side_data_list) {
      for (const sideData of stream.side_data_list) {
        if (sideData.side_data_type === 'DOVI configuration record' ||
            sideData.side_data_type === 'Dolby Vision configuration record') {
          hasDV = true;
          break;
        }
      }
    }

    // Check codec tag string for DOVI
    if (stream.codec_tag_string && stream.codec_tag_string.includes('dovi')) {
      hasDV = true;
    }

    // Check profile for dolby vision
    if (stream.profile && stream.profile.toLowerCase().includes('dolby vision')) {
      hasDV = true;
    }

    if (hasDV) break;
  }

  if (hasDV) {
    jobLog('⏭️ Skipping: file contains Dolby Vision metadata. Re-encoding could cause playback issues.');
    return {
      outputFileObj: inputFileObj,
      outputNumber: 2,
      variables: args.variables,
    };
  }

  jobLog('✅ Processing: no Dolby Vision detected, safe to transcode.');
  return {
    outputFileObj: inputFileObj,
    outputNumber: 1,
    variables: args.variables,
  };
};

module.exports.details = details;
module.exports.plugin = plugin;
