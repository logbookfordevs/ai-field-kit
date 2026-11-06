import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";
import { installPopoverShim } from "@/test/popover-shim";

installPopoverShim();
configure({ asyncUtilTimeout: 5_000 });
afterEach(() => {
  cleanup();
  window.location.hash = "";
});
