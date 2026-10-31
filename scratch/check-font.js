const fs = require("fs");
const buf = fs.readFileSync("public/fonts/Nunito-VariableFont_wght.ttf");
const idx = buf.indexOf("fvar");
if (idx !== -1) {
  const offset = buf.readUInt32BE(idx + 8);
  const axisCount = buf.readUInt16BE(offset + 8);
  console.log("axisCount:", axisCount);
  for (let i = 0; i < axisCount; i++) {
    const axisOffset = offset + 16 + i * 20;
    const tag = buf.toString("utf8", axisOffset, axisOffset + 4);
    const min = buf.readInt32BE(axisOffset + 4) / 65536;
    const def = buf.readInt32BE(axisOffset + 8) / 65536;
    const max = buf.readInt32BE(axisOffset + 12) / 65536;
    console.log(`Axis: ${tag}, min: ${min}, def: ${def}, max: ${max}`);
  }
} else {
  console.log("no fvar found");
}

