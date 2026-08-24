/* =========================================================
   QUICKPAY
   Firebase + QR Prototype
========================================================= */


/* =========================================================
   FIREBASE
========================================================= */

const firebaseConfig = {

    apiKey:
        "AIzaSyC9qC5SRO5hrHMRywxAiQQ--uYdIXL57fw",

    authDomain:
        "quickpay-63af0.firebaseapp.com",

    databaseURL:
        "https://quickpay-63af0-default-rtdb.firebaseio.com",

    projectId:
        "quickpay-63af0",

    storageBucket:
        "quickpay-63af0.firebasestorage.app",

    messagingSenderId:
        "972376102284",

    appId:
        "1:972376102284:web:8113f173fb85457ed332a9"
};


firebase.initializeApp(firebaseConfig);

const database =
    firebase.database();



/* =========================================================
   LOCAL STORAGE
========================================================= */

let accounts =
    JSON.parse(
        localStorage.getItem("quickpay_accounts") || "[]"
    );

let localTransactions =
    JSON.parse(
        localStorage.getItem("quickpay_transactions") || "[]"
    );


function saveAccounts() {

    localStorage.setItem(
        "quickpay_accounts",
        JSON.stringify(accounts)
    );
}


function saveLocalTransactions() {

    localStorage.setItem(
        "quickpay_transactions",
        JSON.stringify(localTransactions)
    );
}



/* =========================================================
   CURRENT STATE
========================================================= */

let currentReceiveRef = null;

let receiveListener = null;

let scanner = null;

let scannerRunning = false;

let scannedPayment = null;

let selectedAccountForDelete = null;

let transactionFilter = "all";

let pendingSessionToken = null;

let isListeningForReceived = false;



/* =========================================================
   NOTIFICATION SYSTEM
========================================================= */

function showToast(message, type) {

    type = type || "info";


    /* Remove existing toasts. */

    const oldToasts =
        document.querySelectorAll(".toast");


    oldToasts.forEach(toast => {

        toast.remove();

    });


    const toast =
        document.createElement("div");


    toast.className =
        "toast toast-" + type;


    toast.textContent =
        message;


    document.body.appendChild(toast);


    /* Auto-dismiss after 4 seconds. */

    setTimeout(() => {

        toast.style.opacity = "0";

        toast.style.transition = "opacity .3s";


        setTimeout(() => {

            toast.remove();

        }, 300);

    }, 4000);
}



/* =========================================================
   PAGE NAVIGATION
========================================================= */

function showPage(pageId) {

    document
        .querySelectorAll(".page")
        .forEach(page => {

            page.classList.remove("active");

        });

    const page =
        document.getElementById(pageId);

    if (page) {

        page.classList.add("active");

    }

    window.scrollTo(0, 0);
}


function goHome() {

    stopScanner();

    stopReceiveListener();

    showPage("homePage");
}


function openSendPage() {

    populateSendAccounts();

    document.getElementById("sendPin").value = "";

    document.getElementById("sendAmount").value = "";

    document.getElementById("manualTransactionId").value = "";

    showPage("sendPage");
}


function openReceivePage() {

    populateReceiveAccounts();

    document
        .getElementById("receiveForm")
        .classList.remove("hidden");

    document
        .getElementById("qrArea")
        .classList.add("hidden");

    showPage("receivePage");
}


function openAccountsPage() {

    renderAccounts();

    showPage("accountsPage");
}


function openTransactionsPage() {

    renderTransactions();

    showPage("transactionsPage");
}



/* =========================================================
   TOGGLE FIELDS
========================================================= */

function toggleFields() {

    const provider =
        document.getElementById("accountProvider").value;

    const accountNumberGroup =
        document.getElementById("accountNumberGroup");

    const nationalIdGroup =
        document.getElementById("nationalIdGroup");

    const accountPinGroup =
        document.getElementById("accountPinGroup");

    const bankProviders = ["fdh", "nbs", "national"];

    if (provider) {
        accountNumberGroup.classList.add("visible");
        accountPinGroup.classList.add("visible");

        if (bankProviders.includes(provider)) {
            nationalIdGroup.classList.add("visible");
        } else {
            nationalIdGroup.classList.remove("visible");
        }
    } else {
        accountNumberGroup.classList.remove("visible");
        nationalIdGroup.classList.remove("visible");
        accountPinGroup.classList.remove("visible");
    }
}



/* =========================================================
   VERIFY ACCOUNT FROM FIREBASE
========================================================= */

async function verifyAccount(provider, accountNumber, password, nationalId = null) {

    try {

        const snapshot = await database
            .ref(`mock_bank_data/${provider}`)
            .once("value");

        const accounts = snapshot.val();

        if (!accounts) {
            return { success: false, message: "Provider not found." };
        }

        const accountList = Object.values(accounts);
        const account = accountList.find(a => a.accountNumber === accountNumber);

        if (!account) {
            return { success: false, message: "Account number not found." };
        }

        if (account.password !== password) {
            return { success: false, message: "Invalid password." };
        }

        if (account.type === "bank") {
            if (!nationalId || account.nationalId !== nationalId) {
                return { success: false, message: "Invalid National ID." };
            }
        }

        const token = generateToken(accountNumber, provider);

        return {
            success: true,
            account: {
                number: account.accountNumber,
                name: account.name,
                provider: provider,
                balance: account.balance || 0,
                type: account.type || "mobile"
            },
            token: token
        };

    } catch (error) {
        console.error("Verification error:", error);
        return { success: false, message: "Verification failed: " + error.message };
    }
}



/* =========================================================
   GENERATE SESSION TOKEN
========================================================= */

function generateToken(accountNumber, provider) {

    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    const token = btoa(`${accountNumber}:${provider}:${timestamp}:${random}`);
    return token;
}


function decodeToken(token) {

    try {
        const decoded = atob(token);
        const parts = decoded.split(":");
        return {
            accountNumber: parts[0],
            provider: parts[1],
            timestamp: parts[2],
            random: parts[3]
        };
    } catch (e) {
        return null;
    }
}



/* =========================================================
   CALCULATE FEE
========================================================= */

function calculateFee(senderProvider, receiverProvider) {

    const isBank = (provider) => {
        return provider === "fdh" || provider === "nbs" || provider === "national";
    };

    const senderIsBank = isBank(senderProvider);
    const receiverIsBank = isBank(receiverProvider);

    // Same provider (TNM to TNM, Airtel to Airtel, Bank to same Bank)
    if (senderProvider === receiverProvider) {
        return 20;
    }

    // Both are mobile but different (TNM to Airtel or vice versa)
    if (!senderIsBank && !receiverIsBank) {
        return 30;
    }

    // Both are banks but different (FDH to NBS, etc.)
    if (senderIsBank && receiverIsBank) {
        return 40;
    }

    // One is bank, one is mobile
    return 50;
}



/* =========================================================
   UPDATE ACCOUNT BALANCE
========================================================= */

async function updateBalance(accountNumber, provider, newBalance) {

    try {
        const snapshot = await database
            .ref(`mock_bank_data/${provider}`)
            .once("value");

        const accounts = snapshot.val();
        if (!accounts) return { success: false, message: "Provider not found" };

        const accountKey = Object.keys(accounts).find(
            key => accounts[key].accountNumber === accountNumber
        );

        if (!accountKey) {
            return { success: false, message: "Account not found" };
        }

        await database
            .ref(`mock_bank_data/${provider}/${accountKey}/balance`)
            .set(newBalance);

        return { success: true };

    } catch (error) {
        console.error("Balance update error:", error);
        return { success: false, message: "Balance update failed" };
    }
}



/* =========================================================
   SEND MONEY FUNCTION
========================================================= */

async function sendMoney(sessionToken, receiverNumber, amount, fee) {

    try {
        const decoded = decodeToken(sessionToken);
        if (!decoded) {
            return { success: false, message: "Invalid session" };
        }

        const { accountNumber, provider } = decoded;

        // Get sender details
        const senderSnapshot = await database
            .ref(`mock_bank_data/${provider}`)
            .once("value");

        const senderAccounts = senderSnapshot.val();
        if (!senderAccounts) {
            return { success: false, message: "Sender provider not found" };
        }

        const senderKey = Object.keys(senderAccounts).find(
            key => senderAccounts[key].accountNumber === accountNumber
        );

        if (!senderKey) {
            return { success: false, message: "Sender account not found" };
        }

        const sender = senderAccounts[senderKey];
        const totalAmount = amount + fee;

        if (sender.balance < totalAmount) {
            return { success: false, message: "Insufficient balance. You have MWK " + formatMoney(sender.balance) };
        }

        // Find receiver (check all providers)
        const providers = ["tnm", "airtel", "fdh", "nbs", "national"];
        let receiverAccount = null;
        let receiverProvider = null;
        let receiverKey = null;

        for (const prov of providers) {
            const snapshot = await database
                .ref(`mock_bank_data/${prov}`)
                .once("value");

            const accounts = snapshot.val();
            if (!accounts) continue;

            const key = Object.keys(accounts).find(
                k => accounts[k].accountNumber === receiverNumber
            );

            if (key) {
                receiverAccount = accounts[key];
                receiverProvider = prov;
                receiverKey = key;
                break;
            }
        }

        if (!receiverAccount) {
            return { success: false, message: "Receiver account not found" };
        }

        // Update balances
        const senderNewBalance = sender.balance - totalAmount;
        const receiverNewBalance = receiverAccount.balance + amount;

        // Update sender
        await database
            .ref(`mock_bank_data/${provider}/${senderKey}/balance`)
            .set(senderNewBalance);

        // Update receiver
        await database
            .ref(`mock_bank_data/${receiverProvider}/${receiverKey}/balance`)
            .set(receiverNewBalance);

        // Create transaction record
        const transactionId = "TXN_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);

        const transaction = {
            id: transactionId,
            type: "sent",
            from: accountNumber,
            fromProvider: provider,
            fromName: sender.name,
            to: receiverNumber,
            toProvider: receiverProvider,
            toName: receiverAccount.name,
            amount: amount,
            fee: fee,
            total: totalAmount,
            status: "completed",
            date: new Date().toLocaleDateString(),
            time: new Date().toLocaleTimeString(),
            timestamp: Date.now()
        };

        await database
            .ref(`quickpay_transactions/${transactionId}`)
            .set(transaction);

        return {
            success: true,
            transaction: transaction,
            newBalance: senderNewBalance,
            receiverName: receiverAccount.name,
            receiverProvider: receiverProvider
        };

    } catch (error) {
        console.error("Send money error:", error);
        return { success: false, message: "Transaction failed: " + error.message };
    }
}



/* =========================================================
   ACCOUNTS - ADD ACCOUNT
========================================================= */

async function addAccount() {

    const provider =
        document.getElementById("accountProvider").value;

    const number =
        document.getElementById("accountNumber").value.trim();

    const pin =
        document.getElementById("accountPin").value.trim();

    const nationalId =
        document.getElementById("nationalId").value.trim() || null;


    if (!provider) {
        showToast("Please select a provider.", "error");
        return;
    }

    if (!number) {
        showToast("Please enter the account or mobile number.", "error");
        return;
    }

    if (!pin) {
        showToast("Please enter your PIN/password.", "error");
        return;
    }

    const result = await verifyAccount(provider, number, pin, nationalId);

    if (!result.success) {
        showToast("❌ " + result.message, "error");
        return;
    }

    const account = {
        id: "acc_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8),
        provider: provider,
        number: result.account.number,
        name: result.account.name,
        type: result.account.type || "mobile",
        balance: result.account.balance || 0,
        createdAt: new Date().toISOString()
    };

    const existing = accounts.find(a => a.number === account.number && a.provider === account.provider);
    if (existing) {
        showToast("This account is already added.", "info");
        return;
    }

    accounts.push(account);
    saveAccounts();

    document.getElementById("accountNumber").value = "";
    document.getElementById("accountPin").value = "";
    document.getElementById("nationalId").value = "";

    renderAccounts();

    const displayName = getProviderDisplayName(provider);
    showToast("✅ " + displayName + " account " + result.account.name + " verified and added successfully!", "success");
}


function getProviderDisplayName(provider) {
    const map = {
        'tnm': 'TNM',
        'airtel': 'Airtel Money',
        'fdh': 'FDH Bank',
        'nbs': 'NBS Bank',
        'national': 'National Bank'
    };
    return map[provider] || provider;
}



/* =========================================================
   RENDER ACCOUNTS
========================================================= */

function renderAccounts() {

    const container =
        document.getElementById("accountsList");

    if (!container) return;


    container.innerHTML = "";


    if (accounts.length === 0) {

        container.innerHTML = `

            <div class="empty-transactions">

                <strong>No accounts yet</strong>

                <p>
                    Add a TNM, Airtel, bank or other account below.
                </p>

            </div>

        `;

        return;
    }


    accounts.forEach(account => {

        const card =
            document.createElement("div");

        card.className =
            "account-card";


        const providerDisplay = getProviderDisplayName(account.provider);

        card.innerHTML = `

            <div class="account-provider">
                ${escapeHtml(providerDisplay)}
            </div>

            <div class="account-name">
                ${escapeHtml(account.name)}
            </div>

            <div class="account-number">
                ${escapeHtml(account.number)}
            </div>

            <div class="account-hint">
                Balance: MWK ${formatMoney(account.balance || 0)} • Long press to delete
            </div>

        `;


        let pressTimer = null;


        card.addEventListener(
            "touchstart",
            function () {

                pressTimer =
                    setTimeout(
                        () => {

                            openDeleteModal(account);

                        },
                        700
                    );

            },
            {
                passive: true
            }
        );


        card.addEventListener(
            "touchend",
            function () {

                clearTimeout(pressTimer);

            }
        );


        card.addEventListener(
            "touchmove",
            function () {

                clearTimeout(pressTimer);

            }
        );


        card.addEventListener(
            "mousedown",
            function () {

                pressTimer =
                    setTimeout(
                        () => {

                            openDeleteModal(account);

                        },
                        700
                    );

            }
        );


        card.addEventListener(
            "mouseup",
            function () {

                clearTimeout(pressTimer);

            }
        );


        card.addEventListener(
            "mouseleave",
            function () {

                clearTimeout(pressTimer);

            }
        );


        container.appendChild(card);

    });
}



/* =========================================================
   DELETE ACCOUNT
========================================================= */

function openDeleteModal(account) {

    selectedAccountForDelete =
        account;


    document
        .getElementById("deleteAccountName")
        .textContent =
            getProviderDisplayName(account.provider) +
            " - " +
            account.name;


    document
        .getElementById("deleteAccountNumber")
        .textContent =
            account.number;


    document
        .getElementById("deleteModal")
        .classList.remove("hidden");
}


function closeDeleteModal() {

    selectedAccountForDelete =
        null;

    document
        .getElementById("deleteModal")
        .classList.add("hidden");
}


function confirmDeleteAccount() {

    if (!selectedAccountForDelete) {

        return;
    }


    const id =
        selectedAccountForDelete.id;


    accounts =
        accounts.filter(
            account =>
                account.id !== id
        );


    saveAccounts();

    closeDeleteModal();

    renderAccounts();

    showToast("Account deleted.", "info");
}



/* =========================================================
   POPULATE ACCOUNT SELECTORS
========================================================= */

function populateSendAccounts() {

    const select =
        document.getElementById("sendAccount");

    if (!select) return;


    select.innerHTML = `

        <option value="">
            Select account
        </option>

    `;


    accounts.forEach(account => {

        const option =
            document.createElement("option");

        option.value =
            account.id;

        const providerDisplay = getProviderDisplayName(account.provider);

        option.textContent =
            providerDisplay +
            " - " +
            account.name +
            " (" +
            account.number +
            ")";


        select.appendChild(option);

    });
}


function populateReceiveAccounts() {

    const select =
        document.getElementById("receiveAccount");

    if (!select) return;


    select.innerHTML = `

        <option value="">
            Select account
        </option>

    `;


    accounts.forEach(account => {

        const option =
            document.createElement("option");

        option.value =
            account.id;

        const providerDisplay = getProviderDisplayName(account.provider);

        option.textContent =
            providerDisplay +
            " - " +
            account.name +
            " (" +
            account.number +
            ")";


        select.appendChild(option);

    });
}



/* =========================================================
   RECEIVE — CREATE QR (NO AMOUNT)
========================================================= */

async function createReceiveQR() {

    const accountId =
        document
            .getElementById("receiveAccount")
            .value;


    if (!accountId) {

        showToast("Please select the account that will receive the money.", "error");

        return;
    }


    const account =
        accounts.find(
            item =>
                item.id === accountId
        );


    if (!account) {

        showToast("Account could not be found.", "error");

        return;
    }


    /*
     * Generate a reusable QR code with receiver details only
     * This QR never expires - perfect for agents/merchants
     */

    const qrData =
        JSON.stringify({

            quickpay: true,

            version: 2,

            type: "receiver",

            receiver: {
                provider: account.provider,
                accountNumber: account.number,
                accountName: account.name,
                accountId: account.id
            }

        });


    const qrContainer =
        document.getElementById("qrcode");


    qrContainer.innerHTML = "";


    new QRCode(
        qrContainer,
        {

            text: qrData,

            width: 300,

            height: 300,

            correctLevel:
                QRCode.CorrectLevel.H

        }
    );


    // Generate reusable Transaction ID (account-based)
    const reusableId = 
        account.provider.toUpperCase() + 
        "-" + 
        account.number;


    document.getElementById("displayTransactionId").textContent = reusableId;
    document.getElementById("receiverAccountDisplay").textContent = 
        getProviderDisplayName(account.provider) + " - " + account.name;


    document
        .getElementById("receiveForm")
        .classList.add("hidden");


    document
        .getElementById("qrArea")
        .classList.remove("hidden");


    // Start listening for incoming payments on this account
    startReceiveListener(account);

    showToast("✅ QR Code generated! This QR never expires. Keep it open to receive payments.", "success");
}



/* =========================================================
   RECEIVE — LISTEN FOR INCOMING PAYMENTS
========================================================= */

function startReceiveListener(account) {

    stopReceiveListener();

    if (!account) {
        // Try to get the account from the current QR if not passed
        const accountId = document.getElementById("receiveAccount").value;
        if (accountId) {
            account = accounts.find(a => a.id === accountId);
        }
    }

    if (!account) {
        return;
    }

    // Listen for new transactions where this account is the receiver
    // We'll check all new transactions in the quickpay_transactions node
    const transactionsRef = database.ref("quickpay_transactions");

    receiveListener = transactionsRef.on(
        "child_added",
        async snapshot => {

            const data = snapshot.val();
            
            if (!data) return;

            // Check if this transaction is for this receiver account
            if (data.receiver && 
                data.receiver.accountNumber === account.number && 
                data.receiver.provider === account.provider &&
                data.type === "sent" && // Only sent transactions (from sender)
                data.status === "completed") {

                // This is a payment received by this account
                handleReceivedPayment(data, account);
            }
        }
    );

    isListeningForReceived = true;
}


function stopReceiveListener() {

    if (receiveListener) {
        const transactionsRef = database.ref("quickpay_transactions");
        transactionsRef.off("child_added", receiveListener);
        receiveListener = null;
        isListeningForReceived = false;
    }
}


/* =========================================================
   RECEIVE — HANDLE RECEIVED PAYMENT (WITHOUT CHANGING SCREEN)
========================================================= */

function handleReceivedPayment(data, account) {

    const amount = Number(data.amount || 0);
    const senderName = data.fromName || "Someone";
    const senderProvider = getProviderDisplayName(data.fromProvider || "");

    // Add to local transactions
    const receivedRecord = {
        id: "local_" + Date.now(),
        type: "received",
        status: "done",
        amount: amount,
        fee: Number(data.fee || 0),
        total: amount + Number(data.fee || 0),
        provider: data.fromProvider,
        name: senderName,
        accountNumber: data.from || "",
        date: data.date || new Date().toLocaleDateString(),
        time: data.time || new Date().toLocaleTimeString(),
        transactionId: data.id
    };

    localTransactions.unshift(receivedRecord);
    saveLocalTransactions();

    // Update local account balance
    const accountToUpdate = accounts.find(a => a.id === account.id);
    if (accountToUpdate) {
        // We need to fetch the latest balance from Firebase
        database.ref(`mock_bank_data/${account.provider}`)
            .once("value")
            .then(snapshot => {
                const accountsData = snapshot.val();
                if (accountsData) {
                    const accountList = Object.values(accountsData);
                    const found = accountList.find(a => a.accountNumber === account.number);
                    if (found) {
                        accountToUpdate.balance = found.balance || 0;
                        saveAccounts();
                        renderAccounts();
                    }
                }
            });
    }

    // Show notification - toast appears even if on different page
    showToast(
        "💰 Payment Received!\n\n" +
        "MWK " + formatMoney(amount) +
        " from " + senderName +
        "\n(" + senderProvider + ")",
        "success"
    );

    // Also show a browser notification if permitted
    if (Notification && Notification.permission === "granted") {
        new Notification("QuickPay - Payment Received", {
            body: "MWK " + formatMoney(amount) + " received from " + senderName,
            icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%23087f5b'/%3E%3Ctext x='50' y='65' text-anchor='middle' font-size='40' fill='white' font-family='Arial'%3E%24%3C/text%3E%3C/svg%3E"
        });
    }

    // Play a sound notification (optional)
    try {
        const audio = new Audio('data:audio/wav;base64,UklGRlAAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAABEQVQ4');
        audio.volume = 0.3;
        audio.play().catch(() => {});
    } catch (e) {}

    // Refresh transactions list if on transactions page
    if (document.getElementById("transactionsPage").classList.contains("active")) {
        renderTransactions();
    }
}



/* =========================================================
   RECEIVE — CANCEL (Just hides QR)
========================================================= */

function cancelReceivePayment() {

    stopReceiveListener();

    document
        .getElementById("qrArea")
        .classList.add("hidden");


    document
        .getElementById("receiveForm")
        .classList.remove("hidden");


    showToast("QR Code closed.", "info");
}



/* =========================================================
   QR SAVE
========================================================= */

function getQRCodeImage() {

    const qr =
        document.getElementById("qrcode");


    if (!qr) return null;


    const canvas =
        qr.querySelector("canvas");


    if (canvas) {

        return canvas.toDataURL(
            "image/png"
        );

    }


    const img =
        qr.querySelector("img");


    if (img) {

        return img.src;

    }


    return null;
}


function saveQRCode() {

    const image =
        getQRCodeImage();


    if (!image) {

        showToast("QR code is not ready.", "error");

        return;
    }


    const link =
        document.createElement("a");


    link.href =
        image;


    link.download =
        "QuickPay-QR-" +
        "receiver" +
        ".png";


    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    showToast("QR code saved.", "success");
}



/* =========================================================
   QR SHARE
========================================================= */

async function shareQRCode() {

    const image =
        getQRCodeImage();


    if (!image) {

        showToast("QR code is not ready.", "error");

        return;
    }


    try {

        const response =
            await fetch(image);


        const blob =
            await response.blob();


        const file =
            new File(
                [
                    blob
                ],
                "QuickPay-QR.png",
                {
                    type: "image/png"
                }
            );


        if (
            navigator.share &&
            navigator.canShare &&
            navigator.canShare({
                files: [file]
            })
        ) {

            await navigator.share({

                title:
                    "QuickPay Receive",

                text:
                    "Scan this QuickPay QR code to send me money.",

                files:
                    [file]

            });


            return;
        }


        if (navigator.share) {

            await navigator.share({

                title:
                    "QuickPay Receive",

                text:
                    "Scan this QuickPay QR code to send me money."

            });

            return;
        }


        showToast("Your browser does not support image sharing. Use Save QR instead.", "info");


    } catch (error) {

        console.error(error);

        if (
            error.name !==
            "AbortError"
        ) {

            showToast("Sharing was not available on this device.", "info");

        }

    }

}



/* =========================================================
   RECEIVE — DONE (Go Home but keep listening?)
========================================================= */

function finishReceive() {

    // We stop listening when going home
    // The QR will still work if they come back
    stopReceiveListener();

    document
        .getElementById("qrArea")
        .classList.add("hidden");


    document
        .getElementById("receiveForm")
        .classList.remove("hidden");


    goHome();
}



/* =========================================================
   SEND — START SCANNER
========================================================= */

async function startScanner() {

    const accountId =
        document
            .getElementById("sendAccount")
            .value;


    const pin =
        document
            .getElementById("sendPin")
            .value;


    const amount =
        Number(
            document
                .getElementById("sendAmount")
                .value
        );


    if (!accountId) {

        showToast("Please select the account you want to send from.", "error");

        return;
    }


    if (!pin) {

        showToast("Please enter your account PIN/password.", "error");

        return;
    }


    if (!amount || amount <= 0) {

        showToast("Please enter a valid amount to send.", "error");

        return;
    }


    const account =
        accounts.find(
            item =>
                item.id === accountId
        );


    if (!account) {

        showToast("Selected account not found.", "error");

        return;
    }


    const result = await verifyAccount(
        account.provider,
        account.number,
        pin,
        null
    );

    if (!result.success) {
        showToast("❌ " + result.message, "error");
        return;
    }


    pendingSessionToken = result.token;
    window.pendingSendAccount = account;
    window.pendingAmount = amount;

    showToast("✅ Password verified. Scan QR code or enter Transaction ID.", "success");


    document
        .getElementById("scannerArea")
        .classList.remove("hidden");


    try {

        scanner =
            new Html5Qrcode("reader");


        scannerRunning =
            true;


        await scanner.start(

            {
                facingMode: "environment"
            },

            {
                fps: 10,

                qrbox: {
                    width: 250,
                    height: 250
                },

                aspectRatio: 1

            },

            qrCodeMessage => {

                handleScannedQRCode(
                    qrCodeMessage
                );

            },

            errorMessage => {

                // Intentionally do nothing

            }

        );


    } catch (error) {

        console.error(error);

        document
            .getElementById("scannerArea")
            .classList.add("hidden");


        scannerRunning =
            false;


        showToast("Camera could not be opened.\n\nPlease make sure QuickPay has permission to use the camera.", "error");

    }

}



/* =========================================================
   SEND — LOOKUP TRANSACTION ID (Manual Entry - Reusable)
========================================================= */

async function lookupTransactionId() {

    const transactionId =
        document.getElementById("manualTransactionId").value.trim();


    if (!transactionId) {

        showToast("Please enter a Transaction ID.", "error");

        return;
    }


    if (!pendingSessionToken) {

        showToast("Please verify your password first.", "error");

        return;
    }


    if (!window.pendingSendAccount) {

        showToast("Please select a sending account.", "error");

        return;
    }


    if (!window.pendingAmount || window.pendingAmount <= 0) {

        showToast("Please enter a valid amount.", "error");

        return;
    }


    try {

        const parts = transactionId.split("-");
        
        if (parts.length !== 2) {
            showToast("Invalid Transaction ID format. Expected: PROVIDER-ACCOUNTNUMBER", "error");
            return;
        }

        const providerKey = parts[0].toLowerCase();
        const accountNumber = parts[1];

        const providerMap = {
            'tnm': 'tnm',
            'airtel': 'airtel',
            'fdh': 'fdh',
            'nbs': 'nbs',
            'national': 'national'
        };

        const provider = providerMap[providerKey];
        if (!provider) {
            showToast("Invalid provider in Transaction ID.", "error");
            return;
        }

        const snapshot = await database
            .ref(`mock_bank_data/${provider}`)
            .once("value");

        const accounts = snapshot.val();
        if (!accounts) {
            showToast("Receiver provider not found.", "error");
            return;
        }

        const accountList = Object.values(accounts);
        const receiverAccount = accountList.find(a => a.accountNumber === accountNumber);

        if (!receiverAccount) {
            showToast("Receiver account not found.", "error");
            return;
        }

        const receiverData = {
            provider: provider,
            accountNumber: receiverAccount.accountNumber,
            accountName: receiverAccount.name,
            accountId: receiverAccount.id
        };

        window.pendingReceiver = receiverData;

        const fee = calculateFee(
            window.pendingSendAccount.provider,
            receiverData.provider
        );

        const amount = window.pendingAmount;

        document
            .getElementById("confirmReceiverName")
            .textContent =
                receiverData.accountName;


        document
            .getElementById("confirmReceiverAccount")
            .textContent =
                getProviderDisplayName(receiverData.provider) +
                " • " +
                receiverData.accountNumber;


        document
            .getElementById("confirmAmount")
            .textContent =
                "MWK " +
                formatMoney(amount);


        document
            .getElementById("confirmFee")
            .textContent =
                "MWK " +
                formatMoney(fee);


        document
            .getElementById("confirmTotal")
            .textContent =
                "MWK " +
                formatMoney(amount + fee);


        await stopScanner();

        showPage("confirmPage");


    } catch (error) {

        console.error(error);

        showToast("Could not lookup receiver.", "error");

    }

}



/* =========================================================
   SEND — STOP SCANNER
========================================================= */

async function stopScanner() {

    if (!scanner) {

        scannerRunning =
            false;

        return;
    }


    try {

        if (scannerRunning) {

            await scanner.stop();

        }

    } catch (error) {

        console.log(
            "Scanner stop:",
            error
        );

    }


    try {

        scanner.clear();

    } catch (error) {

        console.log(
            "Scanner clear:",
            error
        );

    }


    scanner =
        null;

    scannerRunning =
        false;


    const area =
        document.getElementById(
            "scannerArea"
        );


    if (area) {

        area.classList.add(
            "hidden"
        );

    }

}



/* =========================================================
   SEND — HANDLE QR (Reusable QR - No Transaction ID)
========================================================= */

async function handleScannedQRCode(message) {

    if (scannedPayment) {
        return;
    }


    let qrData;


    try {

        qrData =
            JSON.parse(message);

    } catch (error) {

        showToast("This is not a valid QuickPay QR code.", "error");

        return;
    }


    if (
        !qrData.quickpay ||
        qrData.version !== 2 ||
        qrData.type !== "receiver"
    ) {

        showToast("This QR code is not a valid receiver QR.", "error");

        return;
    }


    if (!qrData.receiver) {

        showToast("Invalid QR data.", "error");

        return;
    }


    scannedPayment =
        "scanned";


    await stopScanner();


    if (!window.pendingSendAccount) {

        showToast("Please verify your password first.", "error");

        scannedPayment = null;

        return;
    }


    if (!window.pendingAmount || window.pendingAmount <= 0) {

        showToast("Please enter a valid amount.", "error");

        scannedPayment = null;

        return;
    }


    window.pendingReceiver = qrData.receiver;

    const fee = calculateFee(
        window.pendingSendAccount.provider,
        qrData.receiver.provider
    );

    const amount = window.pendingAmount;


    document
        .getElementById(
            "confirmReceiverName"
        )
        .textContent =
            qrData.receiver.accountName;


    document
        .getElementById(
            "confirmReceiverAccount"
        )
        .textContent =
            getProviderDisplayName(qrData.receiver.provider) +
            " • " +
            qrData.receiver.accountNumber;


    document
        .getElementById(
            "confirmAmount"
        )
        .textContent =
            "MWK " +
            formatMoney(amount);


    document
        .getElementById(
            "confirmFee"
        )
        .textContent =
            "MWK " +
            formatMoney(fee);


    document
        .getElementById(
            "confirmTotal"
        )
        .textContent =
            "MWK " +
            formatMoney(amount + fee);


    showPage(
        "confirmPage"
    );

}



/* =========================================================
   SEND — CONFIRM PAYMENT
========================================================= */

async function confirmPayment() {

    const sendAccount =
        window.pendingSendAccount;


    const receiver =
        window.pendingReceiver;


    const amount =
        window.pendingAmount;


    if (
        !sendAccount ||
        !receiver ||
        !amount
    ) {

        showToast("Payment information is missing.", "error");

        return;
    }


    if (!pendingSessionToken) {

        showToast("Session expired. Please verify your password again.", "error");

        cancelConfirmation();

        return;
    }


    const fee = calculateFee(
        sendAccount.provider,
        receiver.provider
    );


    const result = await sendMoney(
        pendingSessionToken,
        receiver.accountNumber,
        amount,
        fee
    );


    if (!result.success) {

        showToast("❌ " + result.message, "error");

        return;
    }


    const sentRecord = {
        id: "local_" + Date.now(),
        type: "sent",
        status: "done",
        amount: amount,
        fee: fee,
        total: amount + fee,
        provider: receiver.provider,
        name: receiver.accountName,
        accountNumber: receiver.accountNumber,
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
        transactionId: result.transaction.id
    };

    localTransactions.unshift(sentRecord);
    saveLocalTransactions();


    const accountToUpdate = accounts.find(a => a.id === sendAccount.id);
    if (accountToUpdate) {
        accountToUpdate.balance = result.newBalance;
        saveAccounts();
        renderAccounts();
    }


    showSendSuccess(amount, receiver);


    clearPendingPayment();

}



/* =========================================================
   SEND — SUCCESS
========================================================= */

function showSendSuccess(amount, receiver) {

    const formattedAmount =
        formatMoney(amount);


    showToast(
        "✅ Payment successful!\n\n" +
        "Sent MWK " +
        formattedAmount +
        "\n" +
        "To: " +
        receiver.accountName +
        "\n" +
        getProviderDisplayName(receiver.provider) +
        " " +
        receiver.accountNumber,
        "success"
    );


    goHome();
}



/* =========================================================
   SEND — CANCEL CONFIRMATION
========================================================= */

function cancelConfirmation() {

    clearPendingPayment();

    showPage(
        "sendPage"
    );
}


function clearPendingPayment() {

    scannedPayment =
        null;

    pendingSessionToken =
        null;

    window.pendingSendAccount =
        null;

    window.pendingReceiver =
        null;

    window.pendingAmount =
        null;

    document.getElementById("manualTransactionId").value = "";
}



/* =========================================================
   TRANSACTIONS
========================================================= */

function showTransactions(filter) {

    transactionFilter =
        filter;


    document
        .querySelectorAll(".tab")
        .forEach(tab => {

            tab.classList.remove(
                "active"
            );

        });


    if (filter === "all") {

        document
            .getElementById("allTab")
            .classList.add("active");

    }

    if (filter === "sent") {

        document
            .getElementById("sentTab")
            .classList.add("active");

    }

    if (filter === "received") {

        document
            .getElementById("receivedTab")
            .classList.add("active");

    }


    renderTransactions();
}


function renderTransactions() {

    const container =
        document.getElementById(
            "transactionsList"
        );


    if (!container) return;


    let records =
        [...localTransactions];


    if (
        transactionFilter !==
        "all"
    ) {

        records =
            records.filter(
                item =>
                    item.type ===
                    transactionFilter
            );

    }


    if (records.length === 0) {

        container.innerHTML = `

            <div class="empty-transactions">

                <strong>
                    No transactions yet
                </strong>

                <p>
                    Your sent and received payments
                    will appear here.
                </p>

            </div>

        `;

        return;
    }


    container.innerHTML = "";


    records.forEach(transaction => {

        const item =
            document.createElement(
                "div"
            );


        item.className =
            "transaction-item";


        const isSent =
            transaction.type ===
            "sent";


        const sign =
            isSent
                ? "-"
                : "+";


        const moneyClass =
            isSent
                ? "money-out"
                : "money-in";


        const title =
            isSent
                ? "Sent to " +
                  transaction.name
                : "Received from " +
                  transaction.name;


        const providerDisplay = getProviderDisplayName(transaction.provider || "");

        item.innerHTML = `

            <div class="transaction-top">

                <div>

                    <strong>
                        ${escapeHtml(title)}
                    </strong>

                    <span>
                        ${escapeHtml(providerDisplay)}
                        •
                        ${escapeHtml(
                            transaction.accountNumber || ""
                        )}
                    </span>

                </div>

                <strong class="${moneyClass}">
                    ${sign} MWK
                    ${formatMoney(
                        transaction.amount
                    )}
                </strong>

            </div>


            <span class="transaction-status transaction-done">
                Completed
            </span>


            <div class="transaction-bottom">

                <span>
                    Fee: MWK ${formatMoney(transaction.fee || 0)}
                </span>

                <span>
                    ${escapeHtml(
                        transaction.date || ""
                    )}
                </span>

                <span>
                    ${escapeHtml(
                        transaction.time || ""
                    )}
                </span>

            </div>

        `;


        container.appendChild(item);

    });
}



/* =========================================================
   HELPERS
========================================================= */

function formatMoney(value) {

    return Number(value || 0)
        .toLocaleString(
            "en-MW",
            {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2
            }
        );
}


function escapeHtml(value) {

    return String(value ?? "")
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}


function getProviderDisplayName(provider) {
    const map = {
        'tnm': 'TNM',
        'airtel': 'Airtel Money',
        'fdh': 'FDH Bank',
        'nbs': 'NBS Bank',
        'national': 'National Bank'
    };
    return map[provider] || provider;
}


function isBankProvider(provider) {
    const banks = ['fdh', 'nbs', 'national'];
    return banks.includes(provider);
}


/* =========================================================
   REQUEST NOTIFICATION PERMISSION
========================================================= */

function requestNotificationPermission() {
    if (Notification && Notification.permission === "default") {
        Notification.requestPermission();
    }
}



/* =========================================================
   INITIALIZE
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        renderAccounts();

        renderTransactions();

        toggleFields();

        requestNotificationPermission();

    }
);
