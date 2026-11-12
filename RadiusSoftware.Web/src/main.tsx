import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";

// 🚀 YAHAN APNI CUSTOM CSS IMPORT KAREIN 
// (Agar aapne code index.css me rakha hai to "./index.css" likhein)
// (Agar App.css me rakha hai to "./App.css" likhein)
import "./index.css"; 

// Bootstrap 5 imports
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);