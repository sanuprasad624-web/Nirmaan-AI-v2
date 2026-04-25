import { useState, useCallback, useEffect, useMemo } from "react";
import { generateWebsite, improveWebsite, planWebsite, regenerateImages, type WebsiteData, type WebsitePlan } from "./services/geminiService";
import { StorageSystem, type NirmaanProject } from "./lib/storage";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Edit3, Monitor, Layers, Eye, Save, Wand2, ArrowLeft, Send, Check, Code, HardDrive, Layout, Palette, List, Download, AlertTriangle, Settings, FileText, Image as ImageIcon, Menu, X, UploadCloud, Smartphone } from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import DOMPurify from "dompurify";

export default function App() {
  const [businessName, setBusinessName] = useState("");
  const [description, setDescription] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlanning, setIsPlanning] = useState(false);
  const [websiteData, setWebsiteData] = useState<WebsiteData | null>(null);
  const [websitePlan, setWebsitePlan] = useState<WebsitePlan | null>(null);
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");
  const [activeTab, setActiveTab] = useState<"generate" | "edit" | "code">("generate");
  const [selectedFileToView, setSelectedFileToView] = useState<string | null>(null);
  const [improvementText, setImprovementText] = useState("");
  const [recentChanges, setRecentChanges] = useState<string[]>([]);
  const [generationTime, setGenerationTime] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [currentPreviewFile, setCurrentPreviewFile] = useState("index.html");
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedElement, setSelectedElement] = useState<{ selector: string; type: string; content?: string, href?: string } | null>(null);
  const [currentProjectId, setCurrentProjectId] = useState<string>(() => `proj_${Date.now()}`);
  const [manualEditValue, setManualEditValue] = useState("");
  const [manualHrefValue, setManualHrefValue] = useState("");
  const [selectedElementStyles, setSelectedElementStyles] = useState<any>({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [logoStatus, setLogoStatus] = useState<string>("");

  const applyManualEdit = useCallback((selector: string, newValue: string, editType: 'text' | 'img' | 'style' | 'link', styleProp?: string) => {
    if (!websiteData || !selector) return;
    
    let currentHtml = websiteData.files[currentPreviewFile] || "";
    const parser = new DOMParser();
    const doc = parser.parseFromString(currentHtml, 'text/html');
    
    const elements = doc.querySelectorAll(selector);
    if (elements.length > 0) {
      const el = elements[0];
      if (editType === 'img') {
        el.setAttribute('src', newValue);
      } else if (editType === 'link') {
        if (el.tagName.toLowerCase() === 'button') {
           if (newValue.startsWith('window.')) {
              el.setAttribute('onclick', newValue);
           } else {
              el.setAttribute('onclick', `window.location.href='${newValue}'`);
           }
        } else {
           el.setAttribute('href', newValue);
        }
      } else if (editType === 'style' && styleProp) {
        (el as HTMLElement).style[styleProp as any] = newValue;
      } else {
        el.innerHTML = newValue;
      }
      
      let finalHtml = "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
      setWebsiteData({
        ...websiteData,
        files: {
          ...websiteData.files,
          [currentPreviewFile]: finalHtml
        }
      });
      // Skip history for live style sliding
      if (editType !== 'style') {
         setRecentChanges([`Elementor Override: ${selector}`, ...recentChanges]);
      }
    }
  }, [websiteData, currentPreviewFile, recentChanges]);

  // Auto-load Memory DB on init
  useEffect(() => {
    const last = StorageSystem.getLastProject();
    if (last && last.data && last.data.files && Object.keys(last.data.files).length > 0) {
      setWebsiteData(last.data);
      setBusinessName(last.name);
      setDescription(last.prompt || "");
      setCurrentProjectId(last.id || `proj_${Date.now()}`);
      // Stay on the Project tab so the user can iterate; they can switch to Source themselves.
    }
  }, []);

  // System Auto-Save
  useEffect(() => {
    if (websiteData) {
      StorageSystem.saveProject({
        id: currentProjectId,
        name: businessName || "Untitled Project",
        timestamp: Date.now(),
        data: websiteData,
        prompt: description
      });
    }
  }, [websiteData, currentProjectId, businessName, description]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGenerating) {
      setGenerationTime(0);
      interval = setInterval(() => {
        setGenerationTime((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isGenerating]);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'NAVIGATE' && e.data?.path) {
        let path = e.data.path;
        // Strip out hash fragments if present
        if (path.includes('#')) {
           path = path.split('#')[0];
        }
        if(path.startsWith('./')) path = path.substring(2);
        if(path.startsWith('/')) path = path.substring(1);
        setCurrentPreviewFile(path);
      }
      if (e.data?.type === 'ELEMENT_SELECTED') {
         setSelectedElement(e.data.payload);
         setManualEditValue(e.data.payload.content || "");
         setManualHrefValue(e.data.payload.href || "");
         setSelectedElementStyles(e.data.payload.styles || {});
      }
      if (e.data?.type === 'FILE_DROPPED') {
         applyManualEdit(e.data.selector, e.data.isImgTag ? e.data.src : `url(${e.data.src})`, e.data.isImgTag ? 'img' : 'style', e.data.isImgTag ? undefined : 'backgroundImage');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [applyManualEdit]);

  const handleStyleChange = (prop: string, val: string) => {
    if (!selectedElement) return;
    setSelectedElementStyles(s => ({...s, [prop]: val}));
    const iframe = document.querySelector('iframe');
    if (iframe && iframe.contentWindow) {
       iframe.contentWindow.postMessage({ type: 'LIVE_STYLE_UPDATE', selector: selectedElement.selector, prop, val }, '*');
    }
    // Debounce actual DOM update for performance
    clearTimeout((window as any).styleUpdateTimeout);
    (window as any).styleUpdateTimeout = setTimeout(() => {
       applyManualEdit(selectedElement.selector, val, 'style', prop);
    }, 500);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlan = async () => {
    if (!businessName || !description) return;
    setIsPlanning(true);
    setErrorMessage("");
    try {
      const plan = await planWebsite(businessName, description);
      setWebsitePlan(plan);
    } catch (error: any) {
      console.error("Planning failed:", error);
      setErrorMessage("Analysis failed. Please try a different description.");
    } finally {
      setIsPlanning(false);
    }
  };

  const handleGenerate = async () => {
    if (!businessName || !description) return;
    setIsGenerating(true);
    setErrorMessage("");
    setSelectedFileToView(null);
    try {
      const planContext = websitePlan 
        ? `Website Type: ${websitePlan.type}\nSections: ${websitePlan.sections.join(", ")}\nStructure: ${websitePlan.structure}\nStyle: ${websitePlan.style}${websitePlan.imageMood ? `\nImage Mood: ${websitePlan.imageMood}` : ""}`
        : "";
      const data = await generateWebsite(businessName, description, planContext, websitePlan?.imageMood || "");
      setWebsiteData(data);
      setCurrentPreviewFile("index.html");
      setActiveTab("code");
    } catch (error: any) {
      console.error("Generation failed:", error);
      setErrorMessage(error.message || "Failed to generate website. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleImprove = async () => {
    if (!websiteData || !improvementText) return;
    setIsGenerating(true);
    setErrorMessage("");
    setSelectedFileToView(null);
    try {
      const data = await improveWebsite(websiteData, improvementText, selectedElement?.selector);
      setWebsiteData(data);
      const modifiedLog = selectedElement ? `Modified [${selectedElement.type}]: ${improvementText}` : improvementText;
      setRecentChanges([modifiedLog, ...recentChanges]);
      setImprovementText("");
    } catch (error: any) {
      console.error("Improvement failed:", error);
      setErrorMessage(error.message || "Failed to improve website. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerateImages = async () => {
    if (!websiteData) return;
    setIsGenerating(true);
    setErrorMessage("");
    setSelectedFileToView(null);
    try {
      const data = await regenerateImages(websiteData, websitePlan?.imageMood || "");
      setWebsiteData(data);
      setRecentChanges(["Regenerated all images with fresh AI prompts", ...recentChanges]);
    } catch (error: any) {
      console.error("Image regeneration failed:", error);
      setErrorMessage(error.message || "Failed to regenerate images. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  // ----- Image upload from device (Edit-mode image picker) -----
  const handleImageFileUpload = (file: File) => {
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 4 * 1024 * 1024) {
      setErrorMessage("Image must be smaller than 4 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      setManualEditValue(dataUrl);
      const iframe = document.querySelector('iframe');
      if (iframe && iframe.contentWindow && selectedElement) {
        iframe.contentWindow.postMessage(
          { type: 'LIVE_UPDATE_IMG', selector: selectedElement.selector, src: dataUrl },
          '*'
        );
      }
      if (selectedElement) {
        applyManualEdit(selectedElement.selector, dataUrl, 'img');
      }
    };
    reader.readAsDataURL(file);
  };

  // ----- Logo upload: replaces text brand in nav with an <img> linked home -----
  const handleLogoUpload = (file: File) => {
    if (!websiteData) return;
    if (!file || !file.type.startsWith("image/")) {
      setLogoStatus("Please choose an image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoStatus("Logo must be smaller than 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      const updated: Record<string, string> = {};
      let changedCount = 0;
      const escapedName = (businessName || websiteData.name || "")
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      Object.entries(websiteData.files).forEach(([fname, raw]) => {
        if (!fname.toLowerCase().endsWith(".html") || typeof raw !== "string") {
          updated[fname] = raw as string;
          return;
        }
        try {
          const doc = new DOMParser().parseFromString(raw, "text/html");
          // Find brand element by common patterns
          let brand: HTMLElement | null = doc.querySelector(
            "header .logo, header .brand, header .navbar-brand, nav .logo, nav .brand, nav .navbar-brand, .navbar-brand, .site-logo, .site-title, [class*='logo']"
          );
          // Fallback: find first <a> inside header/nav whose text matches the business name
          if (!brand && escapedName) {
            const re = new RegExp(escapedName, "i");
            const candidates = doc.querySelectorAll("header a, nav a, header h1, header h2, nav h1, nav h2");
            for (const c of Array.from(candidates)) {
              if (re.test(c.textContent || "")) {
                brand = c as HTMLElement;
                break;
              }
            }
          }
          // Last fallback: first <a> in nav
          if (!brand) brand = doc.querySelector("nav a, header a") as HTMLElement | null;
          if (!brand) {
            updated[fname] = raw;
            return;
          }
          const img = doc.createElement("img");
          img.setAttribute("src", dataUrl);
          img.setAttribute("alt", businessName || "Logo");
          img.setAttribute("style", "max-height:48px;width:auto;display:block;");
          // If brand IS an <a>, set href + replace its content; otherwise wrap with an <a>
          if (brand.tagName.toLowerCase() === "a") {
            brand.setAttribute("href", "index.html");
            brand.innerHTML = "";
            brand.appendChild(img);
          } else {
            const link = doc.createElement("a");
            link.setAttribute("href", "index.html");
            link.style.display = "inline-block";
            link.appendChild(img);
            brand.innerHTML = "";
            brand.appendChild(link);
          }
          updated[fname] = "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
          changedCount++;
        } catch (err) {
          updated[fname] = raw;
        }
      });

      if (changedCount === 0) {
        setLogoStatus("Could not find a brand area to replace. Try regenerating the site first.");
        return;
      }
      setWebsiteData({ ...websiteData, files: updated as WebsiteData["files"] });
      setRecentChanges([`Uploaded logo (applied to ${changedCount} page${changedCount > 1 ? "s" : ""})`, ...recentChanges]);
      setLogoStatus(`Logo applied to ${changedCount} page${changedCount > 1 ? "s" : ""}.`);
    };
    reader.readAsDataURL(file);
  };

  // ----- Build a single self-contained shareable HTML (multi-page → SPA) -----
  const buildShareableHtml = useCallback((): string => {
    if (!websiteData) return "";
    const files = websiteData.files;
    const css = files["assets/css/style.css"] || files["style.css"] || "";
    const js  = files["assets/js/script.js"] || files["script.js"] || "";
    const norm = (k: string) => k.replace(/^\.?\//,"").replace(/\\/g,"/").toLowerCase();
    const pageMap: Record<string, { body: string; title: string; head: string }> = {};
    Object.entries(files).forEach(([fname, raw]) => {
      if (!fname.toLowerCase().endsWith(".html") || typeof raw !== "string") return;
      try {
        const d = new DOMParser().parseFromString(raw, "text/html");
        pageMap[norm(fname)] = {
          body: d.body ? d.body.innerHTML : raw,
          title: d.title || fname,
          head: d.head ? d.head.innerHTML.replace(/<link[^>]*href=["'][^"']*style\.css["'][^>]*>/gi,"") : ""
        };
      } catch { /* ignore */ }
    });
    const startKey = norm(currentPreviewFile in pageMap ? currentPreviewFile : "index.html");
    const dataJson = JSON.stringify(pageMap);
    const startHead = pageMap[startKey]?.head || "";
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${(pageMap[startKey]?.title || websiteData.name || "Website").replace(/[<>]/g,"")}</title>
${startHead}
<style>${css}</style>
</head>
<body>
<div id="nirmaan-app"></div>
<script id="nirmaan-data" type="application/json">${dataJson.replace(/<\/script>/gi,"<\\/script>")}</script>
<script>
(function(){
  var pages = JSON.parse(document.getElementById("nirmaan-data").textContent);
  var pageJs = ${JSON.stringify(js)};
  var defaultPage = ${JSON.stringify(startKey)};
  function norm(k){ return (k||"").replace(/^\\.?\\//,"").replace(/\\\\/g,"/").toLowerCase(); }
  function resolveKey(href){
    if(!href) return null;
    var clean = href.split("#")[0].split("?")[0];
    if(!clean) return null;
    var k = norm(clean);
    if(pages[k]) return k;
    if(pages[k+".html"]) return k+".html";
    var alt = k.replace(/-/g,"_"); if(pages[alt]) return alt;
    var alt2 = k.replace(/_/g,"-"); if(pages[alt2]) return alt2;
    var base = k.split("/").pop();
    if(pages[base]) return base;
    if(pages[base+".html"]) return base+".html";
    return null;
  }
  function render(key, pushHash){
    var page = pages[key] || pages[defaultPage];
    if(!page) return;
    document.title = page.title;
    var app = document.getElementById("nirmaan-app");
    app.innerHTML = page.body;
    Array.from(app.querySelectorAll("script")).forEach(function(s){
      var n = document.createElement("script");
      if(s.src) n.src = s.src; else n.textContent = s.textContent;
      s.parentNode.replaceChild(n, s);
    });
    if(pageJs){ try { (new Function(pageJs))(); } catch(err){ console.warn(err); } }
    if(pushHash){ history.replaceState(null,"","#/"+key); }
    window.scrollTo(0,0);
  }
  document.addEventListener("click", function(e){
    var a = e.target.closest("a");
    if(!a) return;
    var href = a.getAttribute("href");
    if(!href) return;
    if(/^(https?:|mailto:|tel:|data:|javascript:)/i.test(href)) return;
    if(href.charAt(0)==="#"){
      e.preventDefault();
      var id = href.substring(1);
      var t = document.getElementById(id);
      if(t) t.scrollIntoView({behavior:"smooth"});
      return;
    }
    var key = resolveKey(href);
    if(key){ e.preventDefault(); render(key, true); }
  });
  document.addEventListener("submit", function(e){ e.preventDefault(); alert("Form submission simulated in preview."); });
  window.addEventListener("hashchange", function(){
    var h = location.hash.replace(/^#\\//,"");
    var k = resolveKey(h) || defaultPage;
    render(k, false);
  });
  var initial = location.hash.replace(/^#\\//,"");
  render(resolveKey(initial) || defaultPage, false);
})();
</script>
</body>
</html>`;
  }, [websiteData, currentPreviewFile]);

  const handleDownloadShareable = () => {
    if (!websiteData) return;
    const html = buildShareableHtml();
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    saveAs(blob, `${(websiteData.name || "site").replace(/\s+/g,"_").toLowerCase()}_shareable.html`);
  };

  const handleExportSource = async () => {
    if (!websiteData) return;
    
    try {
        const zip = new JSZip();
        let hasContent = false;
        
        Object.entries(websiteData.files).forEach(([filename, content]) => {
            if (typeof content === "string" && content.trim() !== "") {
                zip.file(filename, content);
                hasContent = true;
            }
        });

        if (!hasContent) throw new Error("No files to zip");

        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, `${websiteData.name.replace(/\s+/g, '_').toLowerCase()}_nirmaan_source.zip`);
    } catch (e) {
        console.warn("ZIP Export failed, bypassing to fallback HTML download...", e);
        // Fallback: If zip fails, just download the index.html directly
        const html = websiteData.files["index.html"] || "";
        const blob = new Blob([html], { type: "text/html;charset=utf-8" });
        saveAs(blob, "index.html");
    }
  };

  const previewHtml = useMemo(() => {
    if (!websiteData) return "";
    let rawHtml = websiteData.files[currentPreviewFile] || `<h1>404: File Not Found (${currentPreviewFile})</h1>`;
    const css = websiteData.files["assets/css/style.css"] || websiteData.files["style.css"];
    const js = websiteData.files["assets/js/script.js"] || websiteData.files["script.js"];

    let html = DOMPurify.sanitize(rawHtml, {
      ADD_TAGS: ['img', 'style', 'script', 'iframe', 'html', 'head', 'body', 'meta', 'title'],
      ADD_ATTR: ['src', 'alt', 'style', 'class', 'id', 'onclick', 'referrerpolicy', 'href'],
      FORCE_BODY: true,
      WHOLE_DOCUMENT: true
    });

    if (css) {
      // Clean up link tags that reference the css so they don't break/404 in iframe
      html = html.replace(/<link[^>]*href=["'][^"']*style\.css["'][^>]*>/i, '');
      if (html.includes("</head>")) {
         html = html.replace("</head>", `<style>${css}</style></head>`);
      } else {
         html = `<style>${css}</style>\n` + html;
      }
    }
    
    const interceptorScript = `
      <script>
        document.addEventListener('click', function(e) {
          const a = e.target.closest('a');
          if (a && a.getAttribute('href')) {
            e.preventDefault(); // ALWAYS prevent default navigation to avoid about:blank#blocked
            
            if (${isEditMode}) return; // Let the edit mode selector handle it
            
            const href = a.getAttribute('href');
            if (href.startsWith('#')) {
                // Smooth Scroll Fallback logic for single page inside Sandbox
                const targetId = href.substring(1);
                const targetEl = document.getElementById(targetId);
                if (targetEl) targetEl.scrollIntoView({ behavior: 'smooth' });
            } else if (href.startsWith('http')) {
                window.open(href, '_blank');
            } else {
                window.parent.postMessage({ type: 'NAVIGATE', path: href }, '*');
            }
          }
        });

        // Block form submissions from navigating
        document.addEventListener('submit', function(e) {
            if (${isEditMode}) {
               e.preventDefault();
            } else {
               e.preventDefault();
               alert("Form submission simulated in preview.");
            }
        });

        // Edit Mode Selection Logic
        if (${isEditMode}) {
          document.body.classList.add('nirmaan-edit-mode');
          const style = document.createElement('style');
          style.innerHTML = \`
            .nirmaan-edit-mode * { transition: outline 0.1s; cursor: pointer !important; }
            .nirmaan-edit-mode *:hover { outline: 2px solid #3b82f6 !important; outline-offset: -2px; }
            .nirmaan-selected { outline: 3px solid #f59e0b !important; outline-offset: -2px; background: rgba(245, 158, 11, 0.1) !important; }
            .nirmaan-edit-mode a { cursor: pointer !important; pointer-events: auto !important; }
          \`;
          document.head.appendChild(style);

          function getSelector(el) {
            if (el.tagName.toLowerCase() == "html") return "HTML";
            let str = el.tagName.toLowerCase();
            str += (el.id != "") ? "#" + el.id : "";
            if (el.className) {
              let classes = el.className.split(/\\s+/);
              for (let i = 0; i < classes.length; i++) {
                if (classes[i] && !classes[i].includes('nirmaan') && !classes[i].includes('hover:')) str += "." + classes[i];
              }
            }
            return str;
          }

          document.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            document.querySelectorAll('.nirmaan-selected').forEach(el => el.classList.remove('nirmaan-selected'));
            e.target.classList.add('nirmaan-selected');

            // Build a robust selector for accurate DOM manipulation
            const getDetailedSelector = (element) => {
              const path = [];
              while (element && element.nodeType === Node.ELEMENT_NODE && element.tagName.toLowerCase() !== 'html') {
                  let selector = element.tagName.toLowerCase();
                  if (element.id) {
                      selector += '#' + element.id;
                      path.unshift(selector);
                      break;
                  } else {
                      let sibling = element;
                      let nth = 1;
                      while (sibling = sibling.previousElementSibling) {
                          if (sibling.tagName.toLowerCase() == selector) nth++;
                      }
                      if (nth != 1) selector += ":nth-of-type("+nth+")";
                  }
                  path.unshift(selector);
                  element = element.parentNode;
              }
              return path.join(" > ");
            };

            const selector = getDetailedSelector(e.target);
            const type = e.target.tagName.toLowerCase();
            const content = type === 'img' ? e.target.getAttribute('src') : e.target.innerHTML;
            const href = type === 'a' ? e.target.getAttribute('href') : undefined;
            
            const computedStyle = window.getComputedStyle(e.target);
            const styles = {
               color: computedStyle.color,
               backgroundColor: computedStyle.backgroundColor,
               fontSize: computedStyle.fontSize,
               fontFamily: computedStyle.fontFamily,
               fontWeight: computedStyle.fontWeight,
               textAlign: computedStyle.textAlign,
               borderRadius: computedStyle.borderRadius
            };

            window.parent.postMessage({ 
              type: 'ELEMENT_SELECTED', 
              payload: { selector, type, content, href, styles }
            }, '*');
          }, true);

          // Drag and Drop Logic
          document.addEventListener('dragover', function(e) {
             e.preventDefault();
             if (e.target.nodeType === Node.ELEMENT_NODE) {
               e.target.classList.add('nirmaan-selected');
             }
          });
          document.addEventListener('dragleave', function(e) {
             if (e.target.nodeType === Node.ELEMENT_NODE) {
               e.target.classList.remove('nirmaan-selected');
             }
          });
          document.addEventListener('drop', function(e) {
             e.preventDefault();
             if (e.target.nodeType === Node.ELEMENT_NODE) {
               e.target.classList.remove('nirmaan-selected');
               const dt = e.dataTransfer;
               if (dt && dt.files && dt.files.length > 0) {
                 const file = dt.files[0];
                 if (file.type.indexOf('image/') === 0) {
                   const reader = new FileReader();
                   reader.readAsDataURL(file);
                   reader.onload = function(evt) {
                     const src = evt.target.result;
                     const selector = getDetailedSelector(e.target);
                     window.parent.postMessage({
                        type: 'FILE_DROPPED',
                        selector: selector,
                        src: src,
                        isImgTag: e.target.tagName.toLowerCase() === 'img'
                     }, '*');
                   };
                 }
               }
             }
          });
        }

        // Add Interceptor for Live Updates
        window.addEventListener('message', function(e) {
          if (e.data.type === 'LIVE_UPDATE') {
             const el = document.querySelector(e.data.selector);
             if (el) el.innerHTML = e.data.newHtml;
          }
          if (e.data.type === 'LIVE_UPDATE_IMG') {
             const el = document.querySelector(e.data.selector);
             if (el) el.src = e.data.src;
          }
          if (e.data.type === 'LIVE_STYLE_UPDATE') {
             const el = document.querySelector(e.data.selector);
             if (el) el.style[e.data.prop] = e.data.val;
          }
        });
      </script>
    `;

    if (html.includes("</body>")) {
         html = html.replace(/<script[^>]*src=["'][^"']*script\.js["'][^>]*><\/script>/i, '');
         html = html.replace("</body>", `${interceptorScript}<script>${js || ""}</script></body>`);
    } else {
         html += `\n${interceptorScript}<script>${js || ""}</script>`;
    }
    
    return html;
  }, [websiteData, currentPreviewFile, isEditMode]);

  return (
    <div className="flex h-screen bg-bento-bg text-bento-text-main font-sans overflow-hidden relative">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-30"
        />
      )}
      {/* Sidebar */}
      <aside className={`bento-sidebar flex flex-col z-40 fixed lg:relative inset-y-0 left-0 w-[85vw] max-w-sm lg:w-80 transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-6 border-b border-bento-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-bento-accent rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.5)]">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">NIRMAAN<span className="text-bento-accent">AI</span></h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="status-chip bg-bento-highlight/10 text-bento-highlight border border-bento-highlight/20 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
              Smart Edit
            </span>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 rounded-lg bg-white/5 border border-bento-border hover:bg-white/10"
              aria-label="Close sidebar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="flex border-b border-bento-border bg-[#0a0a0c]">
             <button 
              onClick={() => setActiveTab("generate")}
              className={`flex-1 py-4 text-[10px] font-bold uppercase tracking-[0.2em] transition-all ${activeTab === "generate" ? 'text-bento-accent bg-bento-accent/5 font-black border-b-2 border-bento-accent' : 'text-bento-text-dim hover:text-bento-text-main grayscale opacity-50'}`}
             >
               Project
             </button>
             <button 
              onClick={() => setActiveTab("edit")}
              disabled={!websiteData}
              className={`flex-1 py-4 text-[10px] font-bold uppercase tracking-[0.2em] transition-all ${activeTab === "edit" ? 'text-bento-accent bg-bento-accent/5 font-black border-b-2 border-bento-accent' : 'text-bento-text-dim hover:text-bento-text-main grayscale opacity-50'} disabled:opacity-5`}
             >
               Improve
             </button>
             <button 
              onClick={() => setActiveTab("code")}
              disabled={!websiteData}
              className={`flex-1 py-4 text-[10px] font-bold uppercase tracking-[0.2em] transition-all ${activeTab === "code" ? 'text-bento-accent bg-bento-accent/5 font-black border-b-2 border-bento-accent' : 'text-bento-text-dim hover:text-bento-text-main grayscale opacity-50'} disabled:opacity-5`}
             >
               Source
             </button>
          </div>

          <div className="p-6">
            {activeTab === "generate" && (
              <div className="space-y-6">
                <div>
                   <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-3 h-3 text-bento-accent" />
                      <label className="block text-[10px] font-bold text-bento-text-dim uppercase tracking-widest">Brand Forge</label>
                   </div>
                  <input 
                    value={businessName}
                    onChange={(e) => { setBusinessName(e.target.value); setWebsitePlan(null); }}
                    placeholder="e.g. Nexus Dynamics"
                    className="w-full bg-bento-card border border-bento-border rounded-xl px-4 py-3 text-sm focus:border-bento-accent outline-none transition-all placeholder:text-gray-700 shadow-sm"
                  />
                </div>
                <div>
                   <div className="flex items-center gap-2 mb-3">
                      <Layers className="w-3 h-3 text-bento-accent" />
                      <label className="block text-[10px] font-bold text-bento-text-dim uppercase tracking-widest">Architectural Intent</label>
                   </div>
                  <textarea 
                    value={description}
                    onChange={(e) => { setDescription(e.target.value); setWebsitePlan(null); }}
                    rows={4}
                    placeholder="Describe your vision..."
                    className="w-full bg-bento-card border border-bento-border rounded-xl px-4 py-3 text-sm focus:border-bento-accent outline-none transition-all resize-none placeholder:text-gray-700 shadow-sm"
                  />
                </div>

                <AnimatePresence>
                  {!websitePlan ? (
                    <motion.button 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      onClick={handlePlan}
                      disabled={isPlanning || !businessName}
                      className="w-full h-12 bg-white/5 border border-white/10 hover:border-bento-accent text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
                    >
                      {isPlanning ? "ANALYZING..." : "ANALYZE & PLAN"}
                      {!isPlanning && <List className="w-4 h-4" />}
                    </motion.button>
                  ) : (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="space-y-4"
                    >
                      <div className="bg-bento-accent/5 border border-bento-accent/20 rounded-2xl p-5 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-[10px] font-black uppercase text-bento-accent tracking-widest">AI Strategic Plan</h4>
                          <span className="text-[9px] bg-bento-accent text-white px-2 py-0.5 rounded font-black">{websitePlan.type}</span>
                        </div>
                        
                        <div className="space-y-3">
                          <div className="flex items-start gap-3">
                            <Layout className="w-3.5 h-3.5 text-bento-text-dim mt-0.5" />
                            <div className="text-[11px] text-white leading-tight"><span className="text-bento-text-dim uppercase text-[9px] font-bold block mb-0.5 tracking-tighter">Structure</span>{websitePlan.structure}</div>
                          </div>
                          <div className="flex items-start gap-3">
                            <Palette className="w-3.5 h-3.5 text-bento-text-dim mt-0.5" />
                            <div className="text-[11px] text-white leading-tight"><span className="text-bento-text-dim uppercase text-[9px] font-bold block mb-0.5 tracking-tighter">Visual Style</span>{websitePlan.style}</div>
                          </div>
                          <div className="flex items-start gap-3">
                            <List className="w-3.5 h-3.5 text-bento-text-dim mt-0.5" />
                            <div className="text-[11px] text-white leading-tight">
                              <span className="text-bento-text-dim uppercase text-[9px] font-bold block mb-0.5 tracking-tighter">Architecture</span>
                              {websitePlan.sections.join(" → ")}
                            </div>
                          </div>
                        </div>
                      </div>

                      <button 
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="w-full h-12 bg-bento-accent hover:bg-blue-600 disabled:opacity-50 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-xl shadow-bento-accent/20"
                      >
                        {isGenerating ? "FORGING..." : "GENERATE SITE"}
                        {!isGenerating && <Wand2 className="w-4 h-4" />}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {activeTab === "edit" && websiteData && (
              <div className="space-y-8">
                {isEditMode && selectedElement && (
                  <div className="space-y-4">
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                       <div className="text-[10px] uppercase font-bold text-bento-accent tracking-widest mb-4 flex items-center gap-2">
                         <Settings className="w-3 h-3" /> Quick Properties
                       </div>
                       
                       <div className="space-y-4">
                         <div>
                           <label className="text-[9px] uppercase font-bold text-bento-text-dim mb-1 block">Element Type</label>
                           <div className="font-mono text-xs text-white">{selectedElement.type.toUpperCase()}</div>
                         </div>
                         {selectedElement.type !== 'img' ? (
                           <div>
                             <label className="text-[9px] uppercase font-bold text-bento-text-dim mb-1 flex items-center gap-1"><FileText className="w-2.5 h-2.5" /> Text / HTML Content</label>
                             <textarea 
                               value={manualEditValue}
                               onChange={(e) => {
                                 setManualEditValue(e.target.value);
                                 const iframe = document.querySelector('iframe');
                                 if (iframe && iframe.contentWindow) {
                                   iframe.contentWindow.postMessage({ type: 'LIVE_UPDATE', selector: selectedElement.selector, newHtml: e.target.value }, '*');
                                 }
                               }}
                               className="w-full bg-black/40 border border-bento-border rounded-lg p-2 text-xs text-white focus:border-bento-accent outline-none min-h-[100px]"
                             />
                             <button 
                               onClick={() => applyManualEdit(selectedElement.selector, manualEditValue, 'text')}
                               className="mt-2 w-full bg-bento-accent hover:bg-blue-600 text-white font-bold py-2 rounded-lg text-xs"
                             >Apply Change</button>
                           </div>
                         ) : (
                           <div>
                             <label className="text-[9px] uppercase font-bold text-bento-text-dim mb-1 flex items-center gap-1"><ImageIcon className="w-2.5 h-2.5" /> Image Source URL</label>
                             <input 
                               value={manualEditValue.startsWith("data:") ? "(uploaded image)" : manualEditValue}
                               onChange={(e) => {
                                 setManualEditValue(e.target.value);
                                 const iframe = document.querySelector('iframe');
                                 if (iframe && iframe.contentWindow) {
                                   iframe.contentWindow.postMessage({ type: 'LIVE_UPDATE_IMG', selector: selectedElement.selector, src: e.target.value }, '*');
                                 }
                               }}
                               placeholder="Paste an image URL"
                               className="w-full bg-black/40 border border-bento-border rounded-lg p-2 text-xs text-white focus:border-bento-accent outline-none"
                             />
                             <button 
                               onClick={() => applyManualEdit(selectedElement.selector, manualEditValue, 'img')}
                               className="mt-2 w-full bg-bento-accent hover:bg-blue-600 text-white font-bold py-2 rounded-lg text-xs"
                             >Apply Image URL</button>

                             <div className="my-3 flex items-center gap-2 text-[9px] uppercase tracking-widest text-bento-text-dim">
                               <span className="flex-1 h-px bg-bento-border"></span>
                               <span>OR</span>
                               <span className="flex-1 h-px bg-bento-border"></span>
                             </div>

                             <label className="block">
                               <input
                                 type="file"
                                 accept="image/*"
                                 className="hidden"
                                 onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFileUpload(f); e.target.value = ""; }}
                               />
                               <div className="cursor-pointer w-full bg-fuchsia-500/10 hover:bg-fuchsia-500/20 border border-dashed border-fuchsia-500/40 hover:border-fuchsia-400 text-fuchsia-300 font-bold py-3 rounded-lg text-xs flex items-center justify-center gap-2 transition-all">
                                 <UploadCloud className="w-4 h-4" /> Upload from Device
                               </div>
                             </label>
                             <div className="text-[9px] text-bento-text-dim mt-2 text-center">PNG / JPG / WebP up to 4MB. Or drag & drop onto the element.</div>
                           </div>
                         )}

                         {(selectedElement.type === 'a' || selectedElement.type === 'button') && (
                             <div>
                               <label className="text-[9px] uppercase font-bold text-bento-text-dim mb-1 flex items-center gap-1">Link Destination (URL/ID / OnClick)</label>
                               <input 
                                 value={manualHrefValue}
                                 onChange={(e) => setManualHrefValue(e.target.value)}
                                 placeholder={selectedElement.type === 'a' ? "e.g. #contact or about.html" : "e.g. window.location.href='...'"}
                                 className="w-full bg-black/40 border border-bento-border rounded-lg p-2 text-xs text-white focus:border-bento-accent outline-none"
                               />
                               <button 
                                 onClick={() => applyManualEdit(selectedElement.selector, manualHrefValue, 'link')}
                                 className="mt-2 w-full bg-bento-accent hover:bg-blue-600 text-white font-bold py-2 rounded-lg text-xs"
                               >Apply Link/Action</button>
                             </div>
                         )}

                         <div className="pt-4 border-t border-bento-border">
                            <label className="text-[9px] uppercase font-bold text-bento-text-dim mb-3 flex items-center gap-1"><Palette className="w-2.5 h-2.5" /> Typography & Style</label>
                            <div className="grid grid-cols-2 gap-3">
                               <div>
                                  <label className="text-[8px] uppercase text-bento-text-dim tracking-wide mb-1 block">Color</label>
                                  <div className="flex bg-black/40 border border-bento-border rounded-lg overflow-hidden">
                                     <input type="color" value={selectedElementStyles.color || "#ffffff"} onChange={(e) => handleStyleChange('color', e.target.value)} className="w-6 h-6 border-0 p-0 bg-transparent cursor-pointer ml-1 mt-1" />
                                     <input type="text" value={selectedElementStyles.color || ""} onChange={(e) => handleStyleChange('color', e.target.value)} className="w-full bg-transparent p-1 px-2 text-xs text-white focus:outline-none" />
                                  </div>
                               </div>
                               <div>
                                  <label className="text-[8px] uppercase text-bento-text-dim tracking-wide mb-1 block">Background</label>
                                  <div className="flex bg-black/40 border border-bento-border rounded-lg overflow-hidden">
                                     <input type="color" value={selectedElementStyles.backgroundColor && selectedElementStyles.backgroundColor !== 'rgba(0, 0, 0, 0)' ? selectedElementStyles.backgroundColor : "#ffffff"} onChange={(e) => handleStyleChange('backgroundColor', e.target.value)} className="w-6 h-6 border-0 p-0 bg-transparent cursor-pointer ml-1 mt-1" />
                                     <input type="text" value={selectedElementStyles.backgroundColor || ""} onChange={(e) => handleStyleChange('backgroundColor', e.target.value)} className="w-full bg-transparent p-1 px-2 text-xs text-white focus:outline-none placeholder:text-gray-600" placeholder="transparent" />
                                  </div>
                               </div>
                               <div>
                                  <label className="text-[8px] uppercase text-bento-text-dim tracking-wide mb-1 block">Font Size</label>
                                  <input type="text" value={selectedElementStyles.fontSize || ""} onChange={(e) => handleStyleChange('fontSize', e.target.value)} placeholder="e.g. 16px, 1.5rem" className="w-full bg-black/40 border border-bento-border rounded-lg p-1.5 px-2 text-xs text-white focus:border-bento-accent outline-none" />
                               </div>
                               <div>
                                  <label className="text-[8px] uppercase text-bento-text-dim tracking-wide mb-1 block">Font Family</label>
                                  <select value={selectedElementStyles.fontFamily?.replace(/['"]/g, '') || "inherit"} onChange={(e) => handleStyleChange('fontFamily', e.target.value)} className="w-full bg-black/40 border border-bento-border rounded-lg p-1.5 px-2 text-xs text-white focus:border-bento-accent outline-none">
                                     <option value="inherit">Inherit</option>
                                     <option value="system-ui, sans-serif">System UI</option>
                                     <option value="Arial, sans-serif">Arial</option>
                                     <option value="Helvetica Neue, Helvetica, sans-serif">Helvetica</option>
                                     <option value="Times New Roman, Times, serif">Times New Roman</option>
                                     <option value="Verdana, sans-serif">Verdana</option>
                                     <option value="Georgia, serif">Georgia</option>
                                     <option value="Courier New, Courier, monospace">Courier New</option>
                                     <option value="Inter, sans-serif">Inter</option>
                                     <option value="Roboto, sans-serif">Roboto</option>
                                     <option value="Open Sans, sans-serif">Open Sans</option>
                                     <option value="Montserrat, sans-serif">Montserrat</option>
                                  </select>
                               </div>
                               <div>
                                  <label className="text-[8px] uppercase text-bento-text-dim tracking-wide mb-1 block">Font Weight</label>
                                  <select value={selectedElementStyles.fontWeight || "400"} onChange={(e) => handleStyleChange('fontWeight', e.target.value)} className="w-full bg-black/40 border border-bento-border rounded-lg p-1.5 px-2 text-xs text-white focus:border-bento-accent outline-none">
                                     <option value="300">Light (300)</option>
                                     <option value="400">Normal (400)</option>
                                     <option value="500">Medium (500)</option>
                                     <option value="600">Semi Bold (600)</option>
                                     <option value="700">Bold (700)</option>
                                     <option value="800">Extra Bold (800)</option>
                                     <option value="900">Black (900)</option>
                                  </select>
                               </div>
                               <div>
                                  <label className="text-[8px] uppercase text-bento-text-dim tracking-wide mb-1 block">Text Align</label>
                                  <select value={selectedElementStyles.textAlign || "left"} onChange={(e) => handleStyleChange('textAlign', e.target.value)} className="w-full bg-black/40 border border-bento-border rounded-lg p-1.5 px-2 text-xs text-white focus:border-bento-accent outline-none">
                                     <option value="left">Left</option>
                                     <option value="center">Center</option>
                                     <option value="right">Right</option>
                                     <option value="justify">Justify</option>
                                  </select>
                               </div>
                               <div>
                                  <label className="text-[8px] uppercase text-bento-text-dim tracking-wide mb-1 block">Border Radius</label>
                                  <input type="text" value={selectedElementStyles.borderRadius || ""} onChange={(e) => handleStyleChange('borderRadius', e.target.value)} placeholder="e.g. 8px, 50%" className="w-full bg-black/40 border border-bento-border rounded-lg p-1.5 px-2 text-xs text-white focus:border-bento-accent outline-none" />
                               </div>
                            </div>
                         </div>
                       </div>
                    </div>
                    
                    <div className="pt-4 border-t border-bento-border">
                      <label className="block text-[10px] font-bold text-bento-text-dim uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Wand2 className="w-3 h-3 text-bento-accent" /> Neural Override
                      </label>
                      <div className="relative">
                        <textarea 
                          value={improvementText}
                          onChange={(e) => setImprovementText(e.target.value)}
                          placeholder="e.g. 'Make it look more cyberpunk'..."
                          className="w-full bg-bento-card border border-bento-border rounded-xl px-4 py-3 text-sm focus:border-bento-accent outline-none transition-all resize-none mb-3 min-h-[120px] placeholder:text-gray-700"
                        />
                        <button 
                          onClick={handleImprove}
                          disabled={isGenerating || !improvementText}
                          className="w-full py-4 bg-bento-accent hover:bg-blue-600 disabled:opacity-50 rounded-xl text-xs font-black flex items-center justify-center gap-2 tracking-[0.1em] shadow-lg shadow-bento-accent/20"
                        >
                          {isGenerating ? "PROCESSING..." : "OPTIMIZE OUTPUT"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                {!isEditMode && (
                   <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex gap-3 text-sm text-bento-text-dim text-center leading-relaxed mb-6">
                     Tip: Enable "Edit Mode" in the top bar to point-and-click select specific framework elements for pinpoint modification, like an advanced site builder.
                   </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-bento-text-dim uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Sparkles className="w-3 h-3 text-bento-accent" /> Logo Studio
                  </label>
                  <label className="block">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); e.target.value = ""; }}
                    />
                    <div className="cursor-pointer w-full py-3 bg-bento-accent/10 hover:bg-bento-accent/20 border border-dashed border-bento-accent/40 hover:border-bento-accent rounded-xl text-xs font-black flex items-center justify-center gap-2 tracking-[0.1em] text-bento-accent transition-all">
                      <UploadCloud className="w-4 h-4" /> UPLOAD SITE LOGO
                    </div>
                  </label>
                  <p className="text-[10px] text-bento-text-dim mt-2 leading-relaxed px-1">
                    Replaces the text site name in the navbar with your logo across every page. Clicking the logo navigates back to the homepage. PNG / JPG / WebP up to 2MB.
                  </p>
                  {logoStatus && (
                    <div className="mt-2 text-[10px] text-bento-highlight font-bold">{logoStatus}</div>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-bento-text-dim uppercase tracking-widest mb-3 flex items-center gap-2">
                    <ImageIcon className="w-3 h-3 text-bento-accent" /> Image Studio
                  </label>
                  <button
                    onClick={handleRegenerateImages}
                    disabled={isGenerating}
                    className="w-full py-3 bg-fuchsia-500/10 hover:bg-fuchsia-500/20 border border-fuchsia-500/30 hover:border-fuchsia-400 disabled:opacity-50 rounded-xl text-xs font-black flex items-center justify-center gap-2 tracking-[0.1em] text-fuchsia-300 transition-all"
                  >
                    {isGenerating ? "REGENERATING..." : "REGENERATE ALL IMAGES"}
                    {!isGenerating && <Sparkles className="w-3.5 h-3.5" />}
                  </button>
                  <p className="text-[10px] text-bento-text-dim mt-2 leading-relaxed px-1">
                    Re-runs the AI image pipeline with fresh, contextually relevant prompts for every picture on the site.
                  </p>
                </div>

                {(!isEditMode || !selectedElement) && (
                 <div>
                  <label className="block text-[10px] font-bold text-bento-text-dim uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Wand2 className="w-3 h-3 text-bento-accent" /> Neural Instructions
                  </label>
                  <div className="relative">
                    <textarea 
                      value={improvementText}
                      onChange={(e) => setImprovementText(e.target.value)}
                      placeholder="e.g. 'Make the hero title larger and change buttons to neon purple'..."
                      className="w-full bg-bento-card border border-bento-border rounded-xl px-4 py-3 text-sm focus:border-bento-accent outline-none transition-all resize-none mb-3 min-h-[120px] placeholder:text-gray-700"
                    />
                    <button 
                      onClick={handleImprove}
                      disabled={isGenerating || !improvementText}
                      className="w-full py-4 bg-bento-accent hover:bg-blue-600 disabled:opacity-50 rounded-xl text-xs font-black flex items-center justify-center gap-2 tracking-[0.1em] shadow-lg shadow-bento-accent/20"
                    >
                      {isGenerating ? "PROCESSING..." : "OPTIMIZE OUTPUT"}
                    </button>
                  </div>
                 </div>
                )}

                <div>
                   <label className="block text-[10px] font-bold text-bento-text-dim uppercase tracking-widest mb-4">Evolution History</label>
                   <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                      {recentChanges.length === 0 && <div className="text-[10px] text-bento-text-dim italic px-2">No neural edits recorded.</div>}
                      {recentChanges.map((change, i) => (
                        <div key={i} className="flex flex-col gap-2 bg-white/[0.03] p-4 rounded-xl border border-bento-border/50 group">
                           <div className="flex gap-3 items-start text-[11px] text-bento-text-dim">
                             <Check className="w-3 h-3 text-bento-highlight mt-0.5 shrink-0" />
                             <span className="leading-relaxed">{change}</span>
                           </div>
                           <button 
                             onClick={() => {
                               StorageSystem.saveMemory(`Failed constraint: User had to ask to "${change}"`);
                               alert("Added to AI Core Memory. It will not repeat this mistake in future generations.");
                             }}
                             className="text-[9px] text-bento-accent hover:text-white uppercase font-black opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 mt-1 pl-6"
                           >
                              <AlertTriangle className="w-3 h-3" /> Report as AI Mistake (Teach Model)
                           </button>
                        </div>
                      ))}
                   </div>
                </div>
              </div>
            )}

            {activeTab === "code" && websiteData && (
              <div className="space-y-6">
                 <label className="block text-[10px] font-bold text-bento-text-dim uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Code className="w-3 h-3 text-bento-accent" /> Asset Manifest
                 </label>
                 <div className="space-y-3">
                    {Object.keys(websiteData.files).map((filename) => (
                      <button 
                        key={filename} 
                        onClick={() => setSelectedFileToView(filename)}
                        className={`w-full flex items-center justify-between p-4 bg-white/5 border rounded-xl group hover:border-bento-accent/50 transition-all ${selectedFileToView === filename ? "border-bento-accent bg-bento-accent/10" : "border-bento-border"}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-bento-accent/10 flex items-center justify-center">
                            <span className="text-[10px] font-black text-bento-accent">{filename.split('.').pop()?.toUpperCase()}</span>
                          </div>
                          <div className="text-left">
                            <div className="text-[11px] font-bold text-white">{filename}</div>
                            <div className="text-[9px] text-bento-text-dim uppercase tracking-tighter">View Code Source</div>
                          </div>
                        </div>
                        <Eye className="w-4 h-4 text-bento-highlight opacity-0 group-hover:opacity-100 transition-all" />
                      </button>
                    ))}
                 </div>
                 
                 <div className="p-4 bg-bento-accent/5 border border-bento-accent/20 rounded-xl mt-8">
                    <p className="text-[10px] text-bento-accent leading-relaxed font-medium">
                      <span className="font-black uppercase mr-2">Core Debug:</span>
                      All files are currently synced with the Neural Previewer.
                    </p>
                 </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-bento-border bg-[#08080a]">
           <div className="flex items-center gap-2 text-[10px] font-bold text-bento-text-dim uppercase tracking-widest mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-bento-highlight shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse"></span>
              Neural Core Sync
           </div>
           <div className="space-y-2">
             <button
               onClick={handleDownloadShareable}
               disabled={!websiteData}
               className="w-full h-10 bg-bento-accent/15 hover:bg-bento-accent/25 border border-bento-accent/40 hover:border-bento-accent rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-20 flex items-center justify-center gap-2 text-bento-accent"
             >
               Share as Single File <UploadCloud className="w-3 h-3" />
             </button>
             <button 
               onClick={handleExportSource}
               disabled={!websiteData}
               className="w-full h-10 border border-bento-border hover:border-bento-accent hover:bg-bento-accent/10 bg-white/5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-20 flex items-center justify-center gap-2"
             >
               Export Source ZIP <Download className="w-3 h-3" />
             </button>
           </div>
        </div>
      </aside>

      {/* Main Preview Area */}
      <main className="flex-1 flex flex-col relative bg-black">
        {errorMessage && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-red-500/90 text-white px-6 py-3 rounded-lg shadow-xl border border-red-400 flex items-center gap-4">
             <span className="font-bold whitespace-nowrap">Error:</span> 
             <span className="text-sm">{errorMessage}</span>
             <button onClick={() => setErrorMessage("")} className="ml-4 hover:bg-white/20 px-2 py-1 rounded-md text-sm font-bold">Dismiss</button>
          </div>
        )}
        <header className="bento-nav flex items-center justify-between px-3 sm:px-8 z-10 gap-2 flex-wrap">
          <div className="flex items-center gap-2 sm:gap-6 flex-wrap">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg bg-white/5 border border-bento-border hover:bg-white/10"
              aria-label="Open menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex bg-white/5 p-1 rounded-xl border border-bento-border">
              <button 
                onClick={() => { setViewMode("desktop"); setSelectedFileToView(null); }}
                className={`p-2 rounded-lg transition-all ${viewMode === "desktop" && !selectedFileToView ? "bg-bento-accent text-white shadow-lg shadow-bento-accent/20" : "text-bento-text-dim hover:text-bento-text-main"}`}
              >
                <Monitor className="w-4 h-4" />
              </button>
              <button 
                onClick={() => { setViewMode("mobile"); setSelectedFileToView(null); }}
                className={`p-2 rounded-lg transition-all ${viewMode === "mobile" && !selectedFileToView ? "bg-bento-accent text-white shadow-lg shadow-bento-accent/20" : "text-bento-text-dim hover:text-bento-text-main"}`}
              >
                <Monitor className="w-4 h-4 rotate-90" />
              </button>
            </div>
            
            <AnimatePresence>
               {websiteData && !selectedFileToView && (
                 <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex items-center gap-3 ml-2"
                 >
                    <div className="h-4 w-px bg-bento-border mx-2"></div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bento-highlight/10 text-bento-highlight border border-bento-highlight/20 text-[10px] font-black uppercase tracking-[0.2em]">
                       <Eye className="w-3 h-3" /> Preview: {currentPreviewFile}
                    </div>
                 </motion.div>
               )}
               {websiteData && selectedFileToView && (
                 <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex items-center gap-3 ml-2"
                 >
                    <div className="h-4 w-px bg-bento-border mx-2"></div>
                    <button 
                      onClick={() => setSelectedFileToView(null)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bento-accent text-white shadow-lg shadow-bento-accent/20 text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:bg-blue-600"
                    >
                       <ArrowLeft className="w-3 h-3" /> Back to Preview
                    </button>
                 </motion.div>
               )}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-4">
             {websiteData && (
                <>
                  <button 
                    onClick={() => setIsEditMode(!isEditMode)}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-widest transition-all ${isEditMode ? 'bg-fuchsia-500/20 border-fuchsia-500/50 text-fuchsia-400 shadow-[0_0_15px_rgba(217,70,239,0.3)]' : 'bg-white/5 border-white/10 text-bento-text-dim hover:text-white'}`}
                  >
                    <Edit3 className="w-3 h-3" />
                    {isEditMode ? 'Edit Mode ON' : 'Edit Mode OFF'}
                  </button>
                  <button 
                    onClick={() => {
                        const html = buildShareableHtml();
                        const blob = new Blob([html], { type: "text/html;charset=utf-8" });
                        const url = URL.createObjectURL(blob);
                        window.open(url, '_blank');
                    }}
                    className="flex items-center gap-2 bg-bento-accent hover:bg-blue-600 text-white border border-bento-accent px-3 sm:px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg transition-all"
                  >
                    Open Live Link
                  </button>
                  <div className="flex items-center gap-2 bg-bento-accent/10 border border-bento-accent/20 px-4 py-1.5 rounded-full text-bento-accent text-[10px] font-bold uppercase tracking-widest shadow-inner">
                    <HardDrive className="w-3 h-3" />
                    Files: {Object.keys(websiteData.files).length} Assets Verified
                  </div>
                </>
             )}
          </div>
        </header>

        <div className="flex-1 overflow-auto p-3 sm:p-6 lg:p-12 flex justify-center items-start bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from)_0%,_transparent_70%)] from-bento-accent/5">
          <AnimatePresence mode="wait">
            {!websiteData ? (
              <motion.div 
                key="empty"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="max-w-xl text-center mt-20"
              >
                <div className="w-24 h-24 bg-bento-accent/10 border border-bento-accent/20 rounded-3xl flex items-center justify-center text-bento-accent mx-auto mb-10 shadow-2xl shadow-bento-accent/10 relative">
                  <Sparkles className="w-12 h-12" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-bento-highlight rounded-full animate-ping opacity-75"></div>
                </div>
                <h2 className="text-4xl font-black text-white mb-6 tracking-tight leading-tight">NIRMAAN <span className="text-bento-accent">FORGE</span></h2>
                <p className="text-bento-text-dim leading-relaxed mb-12 text-lg font-medium">
                  Autonomous production-grade website generation. <br />
                  <span className="text-bento-text-dim/60 text-sm">Powered by Neural Rendering Architecture v3.</span>
                </p>
                <div className="grid grid-cols-2 gap-4">
                   {[
                     { name: "SaaS Platform", text: "Modern workspace for global remote teams." },
                     { name: "Design Studio", text: "Minimalist portfolio for creative agency." }
                   ].map((prompt, i) => (
                     <button 
                       key={i}
                       onClick={() => { setBusinessName(prompt.name); setDescription(prompt.text); }}
                       className="bg-bento-card border border-bento-border p-6 rounded-[28px] text-left hover:border-bento-accent transition-all group shadow-sm hover:shadow-xl hover:shadow-bento-accent/5"
                     >
                       <div className="font-bold text-white mb-2 group-hover:text-bento-accent transition-colors flex items-center gap-2">
                          <Wand2 className="w-3.5 h-3.5" /> {prompt.name}
                       </div>
                       <div className="text-xs text-bento-text-dim line-clamp-2 leading-relaxed">{prompt.text}</div>
                     </button>
                   ))}
                </div>
              </motion.div>
            ) : selectedFileToView ? (
              <motion.div 
                key="code-viewer"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-6xl h-full min-h-[850px] bg-[#0a0a0c] border border-bento-border rounded-[40px] shadow-[0_40px_100px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col"
              >
                <div className="bg-white/5 border-b border-bento-border px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Code className="w-5 h-5 text-bento-accent" />
                    <h3 className="text-white font-bold tracking-widest text-sm">{selectedFileToView}</h3>
                  </div>
                  <div className="text-[10px] text-bento-text-dim uppercase font-bold tracking-widest bg-black/40 px-3 py-1 rounded-full">Source Code</div>
                </div>
                <div className="flex-1 overflow-auto p-6 custom-scrollbar">
                  <pre className="text-xs text-bento-text-dim font-mono whitespace-pre-wrap leading-relaxed">
                    <code>{websiteData.files[selectedFileToView]}</code>
                  </pre>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="preview"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`transition-all duration-700 shadow-[0_40px_100px_rgba(0,0,0,0.8)] overflow-hidden bg-black border border-bento-border rounded-[20px] sm:rounded-[40px] ${viewMode === "mobile" ? "w-full max-w-[375px] h-[600px] sm:h-[750px]" : "w-full max-w-6xl h-full min-h-[500px] sm:min-h-[700px] lg:min-h-[850px]"}`}
              >
                <iframe 
                  className="w-full h-full border-none bg-white"
                  title="Nirmaan Preview"
                  srcDoc={previewHtml}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Global Loading Overlay */}
        {isGenerating && (
          <div className="fixed inset-0 bg-bento-bg/95 backdrop-blur-xl z-[200] flex items-center justify-center">
             <div className="text-center">
                <div className="relative mb-12 flex justify-center">
                   <div className="w-32 h-32 border-t-2 border-bento-accent rounded-full animate-spin"></div>
                   <div className="absolute inset-0 flex items-center justify-center">
                      <Sparkles className="w-10 h-10 text-bento-accent animate-pulse" />
                   </div>
                </div>
                <h2 className="text-3xl font-bold text-white mb-4 tracking-tight">Synthesizing Neural Structures...</h2>
                <div className="flex flex-col gap-2 items-center">
                   <p className="text-bento-accent/80 text-sm font-bold uppercase tracking-[0.2em] animate-pulse">Running Bento Grid Heuristics</p>
                   <p className="text-bento-text-dim text-xs font-medium mb-4">Generating high-fidelity cells & adaptive layouts</p>
                   {generationTime > 0 && (
                     <div className="bg-black/50 border border-bento-border px-6 py-3 rounded-xl flex items-center justify-center gap-4 shadow-inner mt-2">
                        <div className="text-[10px] font-bold text-bento-text-dim uppercase tracking-[0.2em]">Processing Time</div>
                        <div className="text-xl font-mono font-bold text-white tracking-widest">{formatTime(generationTime)}</div>
                     </div>
                   )}
                </div>
             </div>
          </div>
        )}
      </main>
    </div>
  );
}

