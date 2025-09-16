function setupBatchInputListeners() {
    console.log('🔧 Setting up batch input listeners');

    if (!elements.batchDropZone || !elements.batchTextInput) {
        console.warn('⚠️ Batch input elements not found');
        return;
    }

    elements.batchDropZone.addEventListener('click', (e) => {
        if (e.target === elements.batchTextInput) return;
        activateTextMode();
    });

    if (elements.showTextInputBtn) {
        elements.showTextInputBtn.addEventListener('click', (e) => {
            e.preventDefault();
            activateTextMode();
        });
    }

    if (elements.processBatchBtn) {
        elements.processBatchBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await processBatchInput();
        });
    }

    if (elements.cancelBatchBtn) {
        elements.cancelBatchBtn.addEventListener('click', (e) => {
            e.preventDefault();
            deactivateTextMode();
        });
    }

    elements.batchDropZone.addEventListener('dragover', handleDragOver);
    elements.batchDropZone.addEventListener('dragleave', handleDragLeave);
    elements.batchDropZone.addEventListener('drop', handleDrop);

    elements.batchTextInput.addEventListener('input', handleTextInput);
    elements.batchTextInput.addEventListener('paste', handlePaste);

    console.log('✅ Batch input listeners set up successfully');
}

function activateTextMode() {
    if (!elements.batchDropZone || !elements.batchTextInput) return;

    elements.batchDropZone.classList.add('text-mode');
    elements.batchTextInput.style.display = 'block';
    elements.batchTextInput.focus();

    if (elements.showTextInputBtn) elements.showTextInputBtn.style.display = 'none';
    if (elements.processBatchBtn) elements.processBatchBtn.style.display = 'inline-flex';
    if (elements.cancelBatchBtn) elements.cancelBatchBtn.style.display = 'inline-flex';

    console.log('📝 Text mode activated');
}

function deactivateTextMode() {
    if (!elements.batchDropZone || !elements.batchTextInput) return;

    elements.batchDropZone.classList.remove('text-mode');
    elements.batchTextInput.style.display = 'none';
    elements.batchTextInput.value = '';

    if (elements.showTextInputBtn) elements.showTextInputBtn.style.display = 'inline-flex';
    if (elements.processBatchBtn) elements.processBatchBtn.style.display = 'none';
    if (elements.cancelBatchBtn) elements.cancelBatchBtn.style.display = 'none';

    console.log('📝 Text mode deactivated');
}

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    elements.batchDropZone.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    elements.batchDropZone.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    elements.batchDropZone.classList.remove('drag-over');

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
        processFiles(files);
    } else {
        const text = e.dataTransfer.getData('text/plain');
        if (text) {
            activateTextMode();
            elements.batchTextInput.value = text;
            handleTextInput();
        }
    }
}

async function processFiles(files) {
    console.log('📁 Processing dropped files:', files.length);

    for (const file of files) {
        if (file.type === 'text/plain' || file.type === 'text/csv' || file.name.endsWith('.txt') || file.name.endsWith('.csv')) {
            try {
                const text = await readFileAsText(file);
                activateTextMode();
                elements.batchTextInput.value = text;
                handleTextInput();
                break;
            } catch (error) {
                console.error('❌ Failed to read file:', error);
                showToast('Failed to read file', 'error');
            }
        }
    }
}

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

function handleTextInput() {
    const text = elements.batchTextInput.value.trim();
    const isValid = text.length > 0;
    if (elements.processBatchBtn) {
        elements.processBatchBtn.disabled = !isValid;
    }
}

function handlePaste() {
    setTimeout(() => {
        handleTextInput();
    }, 10);
}

async function processBatchInput() {
    if (isLoading) return;

    const text = elements.batchTextInput.value.trim();
    if (!text) {
        showToast('Please enter some text to process', 'error');
        return;
    }

    try {
        setLoading(true);
        console.log('🔄 Processing batch input');

        const webhooks = parseBatchText(text);
        if (webhooks.length === 0) {
            showToast('No valid DSP codes and webhook URLs found', 'error');
            return;
        }

        let addedCount = 0;
        for (const { dspCode, webhookUrl } of webhooks) {
            const existingEntries = document.querySelectorAll('.webhook-entry .dsp-code');
            const isDuplicate = Array.from(existingEntries).some(input =>
                input.value.trim().toUpperCase() === dspCode.toUpperCase()
            );

            if (!isDuplicate) {
                addWebhookEntry(dspCode, webhookUrl);
                addedCount++;
                console.log(`✅ Added webhook entry: ${dspCode} -> ${webhookUrl.substring(0, 50)}...`);
            } else {
                console.warn(`⚠️ Skipping duplicate DSP code: ${dspCode}`);
            }
        }

        console.log(`💾 Preparing to save ${addedCount} new webhook entries...`);
        await new Promise(resolve => setTimeout(resolve, 100));
        await saveWebhooks();

        showToast(`Successfully imported ${addedCount} webhook${addedCount !== 1 ? 's' : ''}!`, 'success');
        deactivateTextMode();
    } catch (error) {
        console.error('❌ Error processing batch input:', error);
        showToast(`Failed to process batch input: ${error.message}`, 'error');
    } finally {
        setLoading(false);
    }
}

function parseBatchText(text) {
    console.log('📊 Parsing batch text');
    const webhooks = [];
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);

    for (const line of lines) {
        if (!line || line.startsWith('#') || line.startsWith('//')) {
            continue;
        }

        let dspCode = '';
        let webhookUrl = '';

        if (line.includes(',')) {
            const parts = line.split(',').map(part => part.trim());
            if (parts.length >= 2) {
                dspCode = parts[0];
                webhookUrl = parts[1];
            }
        } else if (line.includes('\t')) {
            const parts = line.split('\t').map(part => part.trim());
            if (parts.length >= 2) {
                dspCode = parts[0];
                webhookUrl = parts[1];
            }
        } else if (line.includes('  ')) {
            const parts = line.split(/\s{2,}/).map(part => part.trim());
            if (parts.length >= 2) {
                dspCode = parts[0];
                webhookUrl = parts[1];
            }
        }

        if (dspCode && webhookUrl) {
            if (!/^[A-Za-z0-9]+$/.test(dspCode)) {
                console.warn(`⚠️ Invalid DSP code format: ${dspCode}`);
                continue;
            }
            try {
                new URL(webhookUrl);
            } catch {
                console.warn(`⚠️ Invalid webhook URL: ${webhookUrl}`);
                continue;
            }

            webhooks.push({
                dspCode: dspCode.toUpperCase(),
                webhookUrl: webhookUrl
            });
        } else {
            console.warn(`⚠️ Could not parse line: ${line}`);
        }
    }

    console.log(`📊 Parsed ${webhooks.length} valid webhook entries`);
    return webhooks;
}
