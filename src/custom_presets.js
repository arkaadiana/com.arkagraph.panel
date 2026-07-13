(function() {
    // Wait for DOM to be ready
    document.addEventListener('DOMContentLoaded', () => {
        const btnLoad = document.getElementById('btn-load-preset');
        const btnExport = document.getElementById('btn-export-preset');
        
        const dialogBackdrop = document.getElementById('custom-import-dialog-backdrop');
        const dialogClose = document.getElementById('btn-close-import-dialog');
        const dialogCancel = document.getElementById('btn-import-cancel');
        const dialogOverwrite = document.getElementById('btn-import-overwrite');
        const dialogMerge = document.getElementById('btn-import-merge');
        const dialogInfo = document.getElementById('custom-import-info');

        let pendingPresets = null;

        if (btnLoad) btnLoad.onclick = handleLoad;
        if (btnExport) btnExport.onclick = handleExport;

        if (dialogClose) dialogClose.onclick = hideModal;
        if (dialogCancel) dialogCancel.onclick = hideModal;
        
        if (dialogOverwrite) {
            dialogOverwrite.onclick = () => {
                if (pendingPresets) {
                    savePresets(pendingPresets);
                    showStatus("PRESETS IMPORTED ✓", false);
                    hideModal();
                    setTimeout(() => window.location.reload(), 800);
                }
            };
        }

        if (dialogMerge) {
            dialogMerge.onclick = () => {
                if (pendingPresets) {
                    const existing = getExistingPresets();
                    const merged = mergePresets(existing, pendingPresets);
                    savePresets(merged);
                    showStatus("PRESETS MERGED ✓", false);
                    hideModal();
                    setTimeout(() => window.location.reload(), 800);
                }
            };
        }

        function getExistingPresets() {
            try {
                const raw = localStorage.getItem('arkaGraph.userPresets.v1');
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed)) return parsed;
                }
            } catch (e) {
                console.error("Error reading existing presets:", e);
            }
            return [];
        }

        function savePresets(presets) {
            localStorage.setItem('arkaGraph.userPresets.v1', JSON.stringify(presets));
        }

        function mergePresets(existing, imported) {
            const merged = [...existing];
            imported.forEach(newPreset => {
                // Resolve name conflicts
                let uniqueName = newPreset.name || "Untitled Preset";
                let counter = 1;
                
                const nameExists = (name) => merged.some(p => p.name === name);
                
                if (nameExists(uniqueName)) {
                    uniqueName = `${uniqueName} (Imported)`;
                    while (nameExists(uniqueName)) {
                        uniqueName = `${newPreset.name} (Imported ${counter})`;
                        counter++;
                    }
                }
                
                // Clone preset with unique name
                const presetToPush = JSON.parse(JSON.stringify(newPreset));
                presetToPush.name = uniqueName;
                merged.push(presetToPush);
            });
            return merged;
        }

        function showStatus(msg, isError) {
            const statusMsg = document.getElementById('status-msg');
            if (statusMsg) {
                statusMsg.innerText = msg;
                statusMsg.className = isError ? 'err' : 'ok';
                setTimeout(() => {
                    statusMsg.innerText = 'READY';
                    statusMsg.className = '';
                }, 3000);
            }
        }

        function hideModal() {
            if (dialogBackdrop) {
                dialogBackdrop.classList.add('hidden');
            }
            pendingPresets = null;
        }

        function processImportData(rawJson) {
            try {
                const parsed = JSON.parse(rawJson);
                if (!Array.isArray(parsed)) {
                    showStatus("INVALID PRESET FILE ✗", true);
                    return;
                }
                
                if (parsed.length === 0) {
                    showStatus("PRESET FILE IS EMPTY ✗", true);
                    return;
                }

                // Simple structural check
                const isValid = parsed.every(item => typeof item === 'object' && item !== null && 'name' in item);
                if (!isValid) {
                    showStatus("INVALID PRESET STRUCTURE ✗", true);
                    return;
                }

                pendingPresets = parsed;
                
                // Show import dialog
                if (dialogBackdrop && dialogInfo) {
                    dialogInfo.innerText = `Found ${parsed.length} preset(s) in the file.\n\nChoose 'Merge' to combine them with your current presets (duplicates will be renamed), or 'Overwrite' to completely replace your current library.`;
                    dialogBackdrop.classList.remove('hidden');
                }
            } catch (e) {
                showStatus("FAILED TO PARSE JSON ✗", true);
                console.error(e);
            }
        }

        // Export Functionality
        function handleExport() {
            const presets = getExistingPresets();
            if (presets.length === 0) {
                showStatus("NO PRESETS TO EXPORT ✗", true);
                return;
            }

            const presetsStr = JSON.stringify(presets, null, 2);

            // Check if we are running in CEP
            if (window.cep && window.cep.fs && typeof window.cep.fs.showSaveDialog === 'function') {
                const result = window.cep.fs.showSaveDialog("Export Presets", "", ["json"], "arkagraph_presets.json");
                if (result.err === 0 && result.data) {
                    const writeResult = window.cep.fs.writeFile(result.data, presetsStr);
                    if (writeResult.err === 0) {
                        showStatus("PRESETS EXPORTED ✓", false);
                    } else {
                        showStatus("FAILED TO WRITE FILE ✗", true);
                    }
                }
            } else {
                // Fallback for standard web browser
                const blob = new Blob([presetsStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'arkagraph_presets.json';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                showStatus("PRESETS EXPORTED ✓", false);
            }
        }

        // Load/Import Functionality
        function handleLoad() {
            // Check if we are running in CEP
            if (window.cep && window.cep.fs && typeof window.cep.fs.showOpenDialog === 'function') {
                const result = window.cep.fs.showOpenDialog(false, false, "Import Presets", "", ["json"]);
                if (result.err === 0 && result.data && result.data.length > 0) {
                    const readResult = window.cep.fs.readFile(result.data[0]);
                    if (readResult.err === 0 && readResult.data) {
                        processImportData(readResult.data);
                    } else {
                        showStatus("FAILED TO READ FILE ✗", true);
                    }
                }
            } else {
                // Fallback for standard web browser
                let fileInput = document.getElementById('hidden-import-file');
                if (!fileInput) {
                    fileInput = document.createElement('input');
                    fileInput.type = 'file';
                    fileInput.id = 'hidden-import-file';
                    fileInput.accept = '.json';
                    fileInput.style.display = 'none';
                    document.body.appendChild(fileInput);
                    
                    fileInput.onchange = (e) => {
                        const file = e.target.files[0];
                        if (!file) return;
                        
                        const reader = new FileReader();
                        reader.onload = (evt) => {
                            processImportData(evt.target.result);
                            fileInput.value = ''; // Reset input
                        };
                        reader.readAsText(file);
                    };
                }
                fileInput.click();
            }
        }
    });
})();
