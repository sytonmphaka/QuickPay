// ==========================================
// QUICKPAY - MOCK PAYMENT SYSTEM
// ==========================================

// Demo balance
let balance = 50000;

// Currently scanned payment
let currentPayment = null;

// QR scanner
let scanner = null;


// ==========================================
// SCREEN NAVIGATION
// ==========================================

function showScreen(screenName) {

    document.querySelectorAll(".screen").forEach(screen => {
        screen.classList.remove("active");
    });

    const screen = document.getElementById(screenName);

    if (screen) {
        screen.classList.add("active");
    }

    // Stop camera when leaving Receive screen
    if (screenName !== "receive" && scanner) {
        stopScanner();
    }

    if (screenName === "home") {
        loadAccounts();
    }

    if (screenName === "send") {
        loadSendAccounts();
    }
}


// ==========================================
// ACCOUNT STORAGE
// ==========================================

function getAccounts() {

    const accounts = localStorage.getItem("quickpay_accounts");

    if (!accounts) {
        return [];
    }

    try {
        return JSON.parse(accounts);
    } catch (error) {
        console.error("Account storage error:", error);
        return [];
    }
}


function saveAccounts(accounts) {

    localStorage.setItem(
        "quickpay_accounts",
        JSON.stringify(accounts)
    );
}


// ==========================================
// REGISTER ACCOUNT
// ==========================================

document
    .getElementById("registerForm")
    .addEventListener("submit", function(event) {

        event.preventDefault();

        const provider =
            document.getElementById("provider").value;

        const accountNumber =
            document.getElementById("accountNumber").value.trim();

        const accountName =
            document.getElementById("accountName").value.trim();

        const pin =
            document.getElementById("pin").value.trim();


        if (!provider || !accountNumber || !accountName || !pin) {

            alert("Please complete all fields.");

            return;
        }


        if (pin.length !== 4) {

            alert("Demo PIN must contain 4 digits.");

            return;
        }


        const accounts = getAccounts();


        const account = {

            id: "ACC-" + Date.now(),

            provider: provider,

            accountNumber: accountNumber,

            accountName: accountName,

            // Demo only
            pin: pin

        };


        accounts.push(account);

        saveAccounts(accounts);


        alert(
            "Account registered successfully!\n\n" +
            provider + "\n" +
            accountName
        );


        // Clear form
        document.getElementById("registerForm").reset();


        loadAccounts();

        showScreen("home");
    });


// ==========================================
// DISPLAY REGISTERED ACCOUNTS
// ==========================================

function loadAccounts() {

    const accounts = getAccounts();

    const container =
        document.getElementById("accountsList");


    if (accounts.length === 0) {

        container.innerHTML =
            '<p class="empty">No accounts registered yet.</p>';

        return;
    }


    container.innerHTML = "";


    accounts.forEach(account => {

        const item =
            document.createElement("div");

        item.className = "account-item";


        item.innerHTML = `

            <strong>${escapeHTML(account.provider)}</strong>

            <span>
                ${escapeHTML(account.accountName)}
            </span>

            <span>
                ${maskAccount(account.accountNumber)}
            </span>

        `;


        container.appendChild(item);

    });
}


// ==========================================
// LOAD ACCOUNTS INTO SEND DROPDOWN
// ==========================================

function loadSendAccounts() {

    const select =
        document.getElementById("sendAccount");

    const accounts = getAccounts();


    select.innerHTML =
        '<option value="">Select account</option>';


    if (accounts.length === 0) {

        const option =
            document.createElement("option");

        option.textContent =
            "No registered accounts";

        option.disabled = true;

        select.appendChild(option);

        return;
    }


    accounts.forEach(account => {

        const option =
            document.createElement("option");

        option.value = account.id;

        option.textContent =
            `${account.provider} - ${maskAccount(account.accountNumber)}`;

        select.appendChild(option);

    });
}


// ==========================================
// SEND MONEY
// ==========================================

document
    .getElementById("sendForm")
    .addEventListener("submit", function(event) {

        event.preventDefault();


        const accountID =
            document.getElementById("sendAccount").value;

        const amount =
            Number(document.getElementById("amount").value);

        const pin =
            document.getElementById("sendPin").value.trim();


        if (!accountID) {

            alert("Please select an account.");

            return;
        }


        if (!amount || amount <= 0) {

            alert("Please enter a valid amount.");

            return;
        }


        if (amount > balance) {

            alert("Insufficient demo balance.");

            return;
        }


        const accounts = getAccounts();

        const account =
            accounts.find(acc => acc.id === accountID);


        if (!account) {

            alert("Account could not be found.");

            return;
        }


        // Check demo PIN
        if (account.pin !== pin) {

            alert("Incorrect demo PIN.");

            return;
        }


        // Create transaction ID
        const transactionID =
            "QP-" +
            new Date()
                .toISOString()
                .replace(/\D/g, "")
                .slice(0, 14);


        // ======================================
        // PAYMENT DATA
        // ======================================

        const payment = {

            app: "QuickPay",

            version: "1.0",

            transactionID: transactionID,

            provider: account.provider,

            amount: amount,

            sender: account.accountName,

            senderAccount: account.accountNumber,

            timestamp: new Date().toISOString()

        };


        // ======================================
        // CREATE QR CODE
        // ======================================

        const qrContainer =
            document.getElementById("qrcode");

        qrContainer.innerHTML = "";


        new QRCode(qrContainer, {

            text: JSON.stringify(payment),

            width: 220,

            height: 220,

            correctLevel: QRCode.CorrectLevel.M

        });


        // Display information
        document.getElementById("qrProvider")
            .textContent = account.provider;


        document.getElementById("qrAmount")
            .textContent =
            amount.toLocaleString();


        document.getElementById("qrSender")
            .textContent =
            account.accountName;


        showScreen("paymentQR");

    });


// ==========================================
// START QR SCANNER
// ==========================================

function startScanner() {

    showScreen("receive");


    setTimeout(() => {

        if (scanner) {
            return;
        }


        scanner =
            new Html5Qrcode("reader");


        const config = {

            fps: 10,

            qrbox: {
                width: 250,
                height: 250
            }

        };


        scanner.start(

            {
                facingMode: "environment"
            },

            config,

            onScanSuccess,

            onScanFailure

        )
        .catch(error => {

            console.error(error);

            document.getElementById("scanResult")
                .innerHTML = `

                    <div class="warning">

                        Camera could not be opened.

                        <br><br>

                        Make sure camera permission
                        is allowed and the page is
                        running on HTTPS.

                    </div>

                `;

        });

    }, 300);

}


// ==========================================
// QR SCAN SUCCESS
// ==========================================

function onScanSuccess(decodedText, decodedResult) {

    console.log("QR detected:", decodedText);


    stopScanner();


    try {

        const payment =
            JSON.parse(decodedText);


        // Verify this is our QR
        if (payment.app !== "QuickPay") {

            alert("This is not a QuickPay payment QR.");

            return;
        }


        if (!payment.amount || !payment.provider) {

            alert("Invalid payment QR.");

            return;
        }


        currentPayment = payment;


        // Display confirmation
        document.getElementById("confirmProvider")
            .textContent =
            payment.provider;


        document.getElementById("confirmAmount")
            .textContent =
            Number(payment.amount).toLocaleString();


        document.getElementById("confirmSender")
            .textContent =
            payment.sender;


        document.getElementById("confirmTransaction")
            .textContent =
            payment.transactionID;


        showScreen("confirm");

    }

    catch (error) {

        console.error(error);

        alert(
            "The QR code could not be understood."
        );

    }

}


// ==========================================
// QR SCAN FAILURE
// ==========================================

function onScanFailure(error) {

    // Ignore continuous scanning errors.
    // This function intentionally does nothing.
}


// ==========================================
// STOP CAMERA
// ==========================================

function stopScanner() {

    if (!scanner) {
        return;
    }


    scanner.stop()
        .then(() => {

            scanner.clear();

            scanner = null;

        })
        .catch(error => {

            console.log(
                "Scanner stop error:",
                error
            );

            scanner = null;

        });

}


// ==========================================
// COMPLETE MOCK PAYMENT
// ==========================================

function completePayment() {

    if (!currentPayment) {

        alert("No payment available.");

        return;
    }


    const payment =
        currentPayment;


    // ======================================
    // MOCK TRANSACTION
    // ======================================

    balance += Number(payment.amount);


    // Save new balance
    localStorage.setItem(
        "quickpay_balance",
        balance
    );


    // Display success information
    document.getElementById("successAmount")
        .textContent =
        Number(payment.amount).toLocaleString();


    document.getElementById("successProvider")
        .textContent =
        payment.provider;


    document.getElementById("successTransaction")
        .textContent =
        payment.transactionID;


    showScreen("success");


    currentPayment = null;

}


// ==========================================
// LOAD BALANCE
// ==========================================

function loadBalance() {

    const savedBalance =
        localStorage.getItem("quickpay_balance");


    if (savedBalance !== null) {

        balance =
            Number(savedBalance);

    }


    document.getElementById("balance")
        .textContent =
        balance.toLocaleString();

}


// ==========================================
// MASK ACCOUNT NUMBER
// ==========================================

function maskAccount(account) {

    if (!account) {
        return "";
    }


    if (account.length <= 4) {
        return account;
    }


    const visible =
        account.slice(-4);


    return "•••• " + visible;

}


// ==========================================
// BASIC HTML ESCAPING
// ==========================================

function escapeHTML(text) {

    const div =
        document.createElement("div");

    div.textContent = text;

    return div.innerHTML;

}


// ==========================================
// INITIALIZE APP
// ==========================================

document.addEventListener(
    "DOMContentLoaded",
    function() {

        loadAccounts();

        loadBalance();

    }
);