import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { installPopoverShim } from "@/test/popover-shim";

installPopoverShim();
afterEach(() => {
  cleanup();
  window.location.hash = "";
});
