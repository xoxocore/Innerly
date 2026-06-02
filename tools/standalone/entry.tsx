import { createRoot } from "react-dom/client";
import Page from "@/app/page";

const root = document.getElementById("root");
if (root) createRoot(root).render(<Page />);
