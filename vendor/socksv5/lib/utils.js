var net = require('net');
var Address6 = require('ip-address').Address6;

exports.ipbytes = function(str) {
  var type = net.isIP(str),
      nums,
      bytes,
      i;

  if (type === 4) {
    nums = str.split('.', 4);
    bytes = new Array(4);
    for (i = 0; i < 4; ++i) {
      if (isNaN(bytes[i] = +nums[i]))
        throw new Error('Error parsing IP: ' + str);
    }
  } else if (type === 6) {
    var b = 0;
    var group;

    var addr = new Address6(str);
    nums = addr.parsedAddress;
    bytes = new Array(16);
    for (i = 0; i < 8; ++i, b += 2) {
      group = parseInt(nums[i], 16);
      bytes[b] = group >>> 8;
      bytes[b + 1] = group & 0xFF;
    }
  }

  return bytes;
};
