import path from "path";
import { app } from "electron";
//import { isDev } from "./util.js";

export function getPreloadPath() {
  return path.join(
    app.getAppPath(),
    "dist-electron",
    "electron",
    "preload.cjs"
  );
}
