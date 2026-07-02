import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "node:fs";

const svg = readFileSync(new URL("../public/logo.svg", import.meta.url), "utf8");
const png = new Resvg(svg, {
  fitTo: { mode: "width", value: 1024 },
}).render().asPng();

writeFileSync(new URL("../app-icon.png", import.meta.url), png);
console.log(`wrote app-icon.png (1024x1024, ${png.length} bytes)`);
