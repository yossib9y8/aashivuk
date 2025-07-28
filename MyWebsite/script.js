// Import all necessary Firebase functions directly
import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
    getAuth,
    signInAnonymously,
    signInWithCustomToken,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
    getFirestore,
    collection,
    query,
    where,
    getDocs,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    doc,
    runTransaction,
    writeBatch,
    getDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

console.log('Script started execution.');

// Firebase variables (will be initialized in DOMContentLoaded)
let app;
let auth;
let db;
let currentUserId = null;
let userDisplayName = 'אנונימי';
let isAuthReady = false; // Flag to ensure Firestore operations only happen after auth
let isDomReady = false; // Flag to ensure DOM elements are assigned before initial rendering

// Use your actual Firebase projectId for external deployment
// Replace 'a-a-s-6fe38' with your Firebase Project ID
const firebaseConfig = {
    apiKey: "YOUR_API_KEY", // Replace with your Firebase Web API Key
    authDomain: "a-a-s-6fe38.firebaseapp.com",
    projectId: "a-a-s-6fe38",
    storageBucket: "a-a-s-6fe38.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID", // Replace with your Firebase Messaging Sender ID
    appId: "YOUR_APP_ID" // Replace with your Firebase Web App ID
};

// Global variables for data storage and management (will be populated by Firestore snapshots)
let invoices = [];
let clients = [];
let standaloneChecks = [];
let currentInvoiceDocId = null;
let currentClientDocId = null;
let currentStandaloneCheckDocId = null;

// Pagination state for invoices table
let currentPage = 1;
const itemsPerPage = 10; // Number of invoices per page

// Sorting state for tables
let invoiceSortColumn = 'invoiceDate';
let invoiceSortDirection = 'desc'; // Default: latest first
let clientSortColumn = 'name';
let clientSortDirection = 'asc';
let checkSortColumn = 'date';
let checkSortDirection = 'desc'; // Default: latest first

// DOM Elements - Main Sections
let dashboardPage, invoicesPage, clientsPage, alertsPage, checksPage;

// DOM Elements - Dashboard
let totalInvoicesEl, totalOutstandingEl, totalPaidEl, paymentsThisMonthEl, openInvoicesCountEl, openChecksCountEl, totalClientsEl, activeClientsCountEl;
let addInvoiceDashboardBtn; // New button on dashboard

// DOM Elements - Global Search
let globalSearchInput;

// DOM Elements - User ID Display
let userIdDisplay;

// DOM Elements - Invoices Section
let exportCsvBtn, addInvoiceBtn, invoiceTableBody, prevPageBtn, nextPageBtn, currentPageSpan, totalPagesSpan;
let invoiceTableHeaders; // To store invoice table headers for sorting

// DOM Elements - Invoice Modals
let invoiceModal, invoiceModalTitle, closeInvoiceModalBtn, cancelInvoiceBtn, invoiceForm, saveInvoiceBtn;
let viewInvoiceModal, closeViewInvoiceModalBtn, printInvoiceBtn, editInvoiceBtn, deleteInvoiceBtn;

// DOM Elements - Invoice Form Fields
let invoiceDocIdInput, invoiceIdInput, clientInput, clientSuggestionsDiv, amountInput, invoiceDateInput, termsSelect, termsWarning, dueDateGroup, dueDateInput, statusSelect, paymentMethodSelect, checksGroup, checkInputsContainer, addCheckBtn;

// DOM Elements - Invoice Form Error Messages
let invoiceIdError, clientError, amountError, invoiceDateError, termsError, dueDateError, statusError, paymentMethodError, checksError;

// DOM Elements - Clients Section
let clientSearchInput, addClientBtnClientPage, exportClientsCsvBtn, clientTableBody;
let clientTableHeaders; // To store client table headers for sorting

// DOM Elements - Client Details/Edit Modal (Replaced addEditClientModal)
let clientDetailsModal, clientDetailsModalTitle, closeClientDetailsModalBtn, clientDetailsForm, cancelClientDetailsBtn, saveClientDetailsBtn;
let clientDetailsDocIdInput, clientDetailsNameInput, clientDetailsContactPersonInput, clientDetailsEmailInput, clientDetailsPhoneInput;
let clientDetailsNameError;
let clientRelatedInvoicesTableBody, clientRelatedChecksTableBody, deleteClientBtn;

// DOM Elements - Checks Section
let addStandaloneCheckBtn, exportChecksCsvBtn, checksTableBody;
let checksTableHeaders; // To store checks table headers for sorting

// DOM Elements - Add/Edit Standalone Check Modal
let addEditCheckModal, addEditCheckModalTitle, closeAddEditCheckModalBtn, standaloneCheckForm, cancelStandaloneCheckBtn, saveStandaloneCheckBtn;

// DOM Elements - Standalone Check Form Fields
let standaloneCheckDocIdInput, standaloneCheckNumberInput, standaloneCheckClientInput, standaloneClientSuggestionsDiv, standaloneCheckAmountInput, standaloneCheckDateInput, standaloneCheckStatusSelect;

// DOM Elements - Standalone Check Form Error Messages
let standaloneCheckNumberError, standaloneCheckClientError, standaloneCheckAmountError, standaloneCheckDateError, standaloneCheckStatusError, deleteStandaloneCheckBtn;

// DOM Elements - Alerts Section
let requestNotificationPermissionBtn, overdueInvoicesList, invoicesDueTodayList, invoicesDueSoonList, checksDueTodayList, checksDueSoonList, inactiveClientsList;
let alertCountBadge, navAlertsBtn, logoutBtn;
let navChecksBtn;

// DOM Elements - Confirm Modal & Toast
let confirmModal, confirmModalTitle, confirmModalMessage, cancelConfirmBtn, confirmActionBtn;
let toast;
let loadingOverlay;

// Store the current confirm action callback to allow dynamic assignment and removal
let currentConfirmActionCallback = null;

// --- Helper Functions ---

/**
 * Shows the loading overlay.
 */
function showLoading() {
    if (loadingOverlay) {
        loadingOverlay.classList.remove('hidden');
    } else {
        console.warn("loadingOverlay element not found when trying to show loading.");
    }
}

/**
 * Hides the loading overlay.
 */
function hideLoading() {
    if (loadingOverlay) {
        loadingOverlay.classList.add('hidden');
    } else {
        console.warn("loadingOverlay element not found when trying to hide loading.");
    }
}

/**
 * Shows a specific main content page and hides others.
 * Also updates the active state of sidebar navigation buttons.
 * @param {HTMLElement} pageToShow The DOM element of the page to show.
 */
function showPage(pageToShow) {
    if (!pageToShow) {
        console.error("showPage called with a null page element. This indicates a missing HTML element or a timing issue.");
        return;
    }
    console.log('showPage called for:', pageToShow.id);
    const allPages = [dashboardPage, invoicesPage, clientsPage, checksPage, alertsPage];
    allPages.forEach(page => {
        if (page) { // Add null check for each page in the loop
            if (page === pageToShow) {
                page.classList.add('active');
            } else {
                page.classList.remove('active');
            }
        }
    });
    // Update active state in sidebar
    const navButtons = document.querySelectorAll('.sidebar-nav button');
    navButtons.forEach(button => {
        if (button.dataset.page === pageToShow.id) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
    // Only access globalSearchInput if it's not null
    if (globalSearchInput && pageToShow !== invoicesPage && pageToShow !== clientsPage && pageToShow !== checksPage) {
        globalSearchInput.value = '';
    }
}

/**
 * Shows a modal by adding the 'show' class.
 * @param {HTMLElement} modalElement The modal DOM element.
 */
function showModal(modalElement) {
    if (!modalElement) {
        console.error("showModal called with a null modal element.");
        return;
    }
    console.log('showModal called for:', modalElement.id);
    modalElement.classList.add('show');
    const firstFocusableElement = modalElement.querySelector('input, select, button, [tabindex]:not([tabindex="-1"])');
    if (firstFocusableElement) {
        firstFocusableElement.focus();
    }
}

/**
 * Hides a modal by removing the 'show' class.
 * @param {HTMLElement} modalElement The modal DOM element.
 */
function hideModal(modalElement) {
    if (!modalElement) {
        console.error("hideModal called with a null modal element.");
        return;
    }
    console.log('hideModal called for:', modalElement.id);
    modalElement.classList.remove('show');
}

/**
 * Displays a toast message.
 * @param {string} message The message to display.
 * @param {'success'|'error'|'info'} type The type of message (determines color).
 */
function showToast(message, type = 'info') {
    if (toast) {
        toast.className = 'toast show ' + type;
        toast.textContent = message;
        setTimeout(() => {
            toast.classList.remove('show');
        }, 4000); // 4 seconds total (0.5s fade-in, 3.5s display)
    } else {
        console.warn("Toast element not found.");
    }
}

/**
 * Displays a confirmation modal.
 * @param {string} title The title of the confirmation.
 * @param {string} message The message to display.
 * @param {Function} callback The function to execute if confirmed.
 * @param {string} confirmButtonText Text for the confirm button.
 * @param {string} confirmButtonClass Class for the confirm button (e.g., 'button-danger').
 */
function showConfirmModal(title, message, callback, confirmButtonText = 'אישור', confirmButtonClass = 'button-primary') {
    if (confirmModal && confirmModalTitle && confirmModalMessage && confirmActionBtn) {
        confirmModalTitle.textContent = title;
        confirmModalMessage.textContent = message;
        confirmActionBtn.textContent = confirmButtonText;
        confirmActionBtn.className = `button-primary ${confirmButtonClass}`; // Reset and add class
        currentConfirmActionCallback = callback; // Store the callback
        showModal(confirmModal);
    } else {
        console.error("Confirmation modal elements not found.");
        callback(); // Fallback: execute immediately if modal missing
    }
}

// --- Date Utility Functions ---

/**
 * Formats a Firebase Timestamp or Date object into 'YYYY-MM-DD'.
 * @param {firebase.firestore.Timestamp | Date | string} dateInput
 * @returns {string} Formatted date string or empty string if invalid.
 */
function formatDate(dateInput) {
    if (!dateInput) return '';

    let date;
    if (dateInput instanceof Date) {
        date = dateInput;
    } else if (typeof dateInput === 'string') {
        date = new Date(dateInput);
    } else if (dateInput && typeof dateInput.toDate === 'function') { // Firebase Timestamp
        date = dateInput.toDate();
    } else {
        return ''; // Invalid input
    }

    if (isNaN(date.getTime())) {
        return ''; // Invalid date
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Calculates the due date based on invoice date and terms.
 * @param {string} invoiceDateString 'YYYY-MM-DD'
 * @param {string} terms 'שוטף', 'שוטף+30', 'שוטף+60', 'מזומן', 'צ'קים'
 * @returns {string} Calculated due date 'YYYY-MM-DD' or empty string.
 */
function calculateDueDate(invoiceDateString, terms) {
    if (!invoiceDateString || !terms || ['מזומן', 'צ\'קים'].includes(terms)) {
        return '';
    }

    const date = new Date(invoiceDateString);
    if (isNaN(date.getTime())) {
        return ''; // Invalid invoice date
    }

    switch (terms) {
        case 'שוטף':
            return formatDate(date); // Due date is invoice date
        case 'שוטף+30':
            date.setDate(date.getDate() + 30);
            return formatDate(date);
        case 'שוטף+60':
            date.setDate(date.getDate() + 60);
            return formatDate(date);
        default:
            return '';
    }
}

/**
 * Converts a YYYY-MM-DD date string to a displayable DD/MM/YYYY string.
 * @param {string} dateString
 * @returns {string}
 */
function displayDate(dateString) {
    if (!dateString) return '';
    const parts = dateString.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateString; // Return as is if invalid format
}

/**
 * Converts DD/MM/YYYY to YYYY-MM-DD for input fields.
 * @param {string} displayDateString
 * @returns {string}
 */
function convertToInputDate(displayDateString) {
    if (!displayDateString) return '';
    const parts = displayDateString.split('/');
    if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return '';
}

/**
 * Calculates days until or since a date.
 * @param {string} dateString 'YYYY-MM-DD'
 * @returns {number} Days difference. Positive for future, negative for past.
 */
function getDaysDifference(dateString) {
    if (!dateString) return Infinity; // Treat empty due dates as far future
    const targetDate = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize today's date to start of day

    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // Round up for future dates
    return diffDays;
}


// --- Firestore Interaction Functions ---

/**
 * Listens for real-time updates to invoices for the current user.
 */
function listenForInvoices() {
    if (!db || !currentUserId) {
        console.error("Firestore or User ID not initialized for invoices listener.");
        return;
    }

    const invoicesRef = collection(db, "invoices");
    const q = query(invoicesRef, where("userId", "==", currentUserId));

    onSnapshot(q, (snapshot) => {
        invoices = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        console.log("Invoices updated:", invoices.length);
        updateDashboard();
        renderInvoicesTable();
        updateAlerts();
    }, (error) => {
        console.error("Error listening to invoices:", error);
        showToast("שגיאה בטעינת חשבוניות: " + error.message, 'error');
    });
}

/**
 * Listens for real-time updates to clients for the current user.
 */
function listenForClients() {
    if (!db || !currentUserId) {
        console.error("Firestore or User ID not initialized for clients listener.");
        return;
    }

    const clientsRef = collection(db, "clients");
    const q = query(clientsRef, where("userId", "==", currentUserId));

    onSnapshot(q, (snapshot) => {
        clients = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        console.log("Clients updated:", clients.length);
        updateDashboard();
        renderClientsTable();
        updateAlerts();
    }, (error) => {
        console.error("Error listening to clients:", error);
        showToast("שגיאה בטעינת לקוחות: " + error.message, 'error');
    });
}

/**
 * Listens for real-time updates to standalone checks for the current user.
 */
function listenForStandaloneChecks() {
    if (!db || !currentUserId) {
        console.error("Firestore or User ID not initialized for standalone checks listener.");
        return;
    }

    const checksRef = collection(db, "standaloneChecks");
    const q = query(checksRef, where("userId", "==", currentUserId));

    onSnapshot(q, (snapshot) => {
        standaloneChecks = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        console.log("Standalone checks updated:", standaloneChecks.length);
        updateDashboard();
        renderChecksTable();
        updateAlerts();
    }, (error) => {
        console.error("Error listening to standalone checks:", error);
        showToast("שגיאה בטעינת צ'קים: " + error.message, 'error');
    });
}


/**
 * Saves or updates an invoice in Firestore.
 * @param {Object} invoiceData
 * @param {string} docId Optional. If provided, updates existing doc.
 */
async function saveInvoice(invoiceData, docId = null) {
    showLoading();
    try {
        if (docId) {
            // Update existing invoice
            const invoiceRef = doc(db, "invoices", docId);
            await updateDoc(invoiceRef, { ...invoiceData,
                updatedAt: serverTimestamp()
            });
            showToast('חשבונית עודכנה בהצלחה!', 'success');
        } else {
            // Add new invoice
            await addDoc(collection(db, "invoices"), { ...invoiceData,
                userId: currentUserId,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            showToast('חשבונית נוצרה בהצלחה!', 'success');
        }
        hideModal(invoiceModal);
        resetInvoiceForm();
    } catch (e) {
        console.error("Error saving invoice: ", e);
        showToast("שגיאה בשמירת חשבונית: " + e.message, 'error');
    } finally {
        hideLoading();
    }
}

/**
 * Deletes an invoice and its associated checks from Firestore.
 * @param {string} invoiceId The ID of the invoice document to delete.
 */
async function deleteInvoice(invoiceId) {
    showLoading();
    try {
        await runTransaction(db, async (transaction) => {
            const invoiceRef = doc(db, "invoices", invoiceId);
            const invoiceDoc = await transaction.get(invoiceRef);

            if (!invoiceDoc.exists()) {
                throw "Invoice does not exist!";
            }

            // Get checks associated with this invoice
            const checksToDelete = invoiceDoc.data().checks || [];

            // Delete the invoice
            transaction.delete(invoiceRef);

            // Delete associated checks from the 'checks' subcollection (if any)
            // Note: If you stored checks in a top-level 'checks' collection linked by invoiceId,
            // you would query and delete them here.
            // Assuming checks are embedded or handled within the invoice document or a separate collection
            // not tied to invoice subcollection.
            // If your checks are in a separate collection and linked by invoice ID, you'd do:
            // const checksQuery = query(collection(db, "checks"), where("invoiceId", "==", invoiceId));
            // const checksSnapshot = await transaction.get(checksQuery);
            // checksSnapshot.docs.forEach(checkDoc => transaction.delete(checkDoc.ref));

        });
        showToast('חשבונית וצ'קים קשורים נמחקו בהצלחה!', 'success');
        hideModal(viewInvoiceModal);
    } catch (e) {
        console.error("Error deleting invoice:", e);
        showToast("שגיאה במחיקת חשבונית: " + e.message, 'error');
    } finally {
        hideLoading();
    }
}

/**
 * Saves or updates a client in Firestore.
 * @param {Object} clientData
 * @param {string} docId Optional. If provided, updates existing doc.
 */
async function saveClient(clientData, docId = null) {
    showLoading();
    try {
        if (docId) {
            const clientRef = doc(db, "clients", docId);
            await updateDoc(clientRef, { ...clientData,
                updatedAt: serverTimestamp()
            });
            showToast('פרטי לקוח עודכנו בהצלחה!', 'success');
        } else {
            // Check for duplicate client name (case-insensitive and trimmed)
            const q = query(collection(db, "clients"),
                where("userId", "==", currentUserId),
                where("nameLowercase", "==", clientData.name.toLowerCase().trim())
            );
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                showToast('קיים כבר לקוח עם שם זהה.', 'error');
                clientDetailsNameError.textContent = 'לקוח בשם זה כבר קיים.';
                hideLoading();
                return;
            }

            await addDoc(collection(db, "clients"), { ...clientData,
                userId: currentUserId,
                nameLowercase: clientData.name.toLowerCase().trim(), // For case-insensitive search
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            showToast('לקוח חדש נוצר בהצלחה!', 'success');
        }
        hideModal(clientDetailsModal);
        resetClientDetailsForm();
    } catch (e) {
        console.error("Error saving client: ", e);
        showToast("שגיאה בשמירת לקוח: " + e.message, 'error');
    } finally {
        hideLoading();
    }
}

/**
 * Deletes a client and all associated invoices and standalone checks.
 * This is a critical operation.
 * @param {string} clientId The ID of the client document to delete.
 */
async function deleteClient(clientId) {
    showLoading();
    try {
        await runTransaction(db, async (transaction) => {
            const clientRef = doc(db, "clients", clientId);
            transaction.delete(clientRef); // Delete the client document

            // Query and delete associated invoices
            const invoicesQuery = query(collection(db, "invoices"), where("clientId", "==", clientId), where("userId", "==", currentUserId));
            const invoicesSnapshot = await transaction.get(invoicesQuery);
            invoicesSnapshot.docs.forEach(invoiceDoc => {
                transaction.delete(invoiceDoc.ref);
            });

            // Query and delete associated standalone checks
            const standaloneChecksQuery = query(collection(db, "standaloneChecks"), where("clientId", "==", clientId), where("userId", "==", currentUserId));
            const standaloneChecksSnapshot = await transaction.get(standaloneChecksQuery);
            standaloneChecksSnapshot.docs.forEach(checkDoc => {
                transaction.delete(checkDoc.ref);
            });
        });

        showToast('לקוח וכל הנתונים הקשורים נמחקו בהצלחה!', 'success');
        hideModal(clientDetailsModal);
    } catch (e) {
        console.error("Error deleting client and related data:", e);
        showToast("שגיאה במחיקת לקוח ונתונים קשורים: " + e.message, 'error');
    } finally {
        hideLoading();
    }
}


/**
 * Saves or updates a standalone check in Firestore.
 * @param {Object} checkData
 * @param {string} docId Optional. If provided, updates existing doc.
 */
async function saveStandaloneCheck(checkData, docId = null) {
    showLoading();
    try {
        if (docId) {
            const checkRef = doc(db, "standaloneChecks", docId);
            await updateDoc(checkRef, { ...checkData,
                updatedAt: serverTimestamp()
            });
            showToast('צ'ק עודכן בהצלחה!', 'success');
        } else {
            await addDoc(collection(db, "standaloneChecks"), { ...checkData,
                userId: currentUserId,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            showToast('צ'ק חדש נוצר בהצלחה!', 'success');
        }
        hideModal(addEditCheckModal);
        resetStandaloneCheckForm();
    } catch (e) {
        console.error("Error saving standalone check: ", e);
        showToast("שגיאה בשמירת צ'ק: " + e.message, 'error');
    } finally {
        hideLoading();
    }
}

/**
 * Deletes a standalone check from Firestore.
 * @param {string} checkId The ID of the check document to delete.
 */
async function deleteStandaloneCheck(checkId) {
    showLoading();
    try {
        const checkRef = doc(db, "standaloneChecks", checkId);
        await deleteDoc(checkRef);
        showToast('צ'ק נמחק בהצלחה!', 'success');
        hideModal(addEditCheckModal);
    } catch (e) {
        console.error("Error deleting standalone check:", e);
        showToast("שגיאה במחיקת צ'ק: " + e.message, 'error');
    } finally {
        hideLoading();
    }
}

// --- Data Rendering Functions ---

/**
 * Updates the dashboard cards with current data.
 */
function updateDashboard() {
    if (!isDomReady) return; // Ensure elements exist

    const totalInvoices = invoices.length;
    const totalOutstanding = invoices.filter(inv => inv.status === 'פתוח' || inv.status === 'בפיגור').reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);
    const totalPaid = invoices.filter(inv => inv.status === 'שולם').reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);

    const today = new Date();
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    const paymentsThisMonth = invoices.filter(inv => {
        if (inv.status === 'שולם' && inv.updatedAt) {
            const paidDate = inv.updatedAt.toDate ? inv.updatedAt.toDate() : new Date(inv.updatedAt);
            return paidDate >= thisMonthStart && paidDate < nextMonthStart;
        }
        return false;
    }).reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);

    const openInvoicesCount = invoices.filter(inv => inv.status === 'פתוח' || inv.status === 'בפיגור').length;
    const openChecksCount = standaloneChecks.filter(check => check.status === 'פתוח' || check.status === 'הופקד').length; // Assuming 'הופקד' means not yet cashed
    const totalClientsCount = clients.length;
    const activeClientsCount = new Set(invoices.map(inv => inv.clientId)).size + new Set(standaloneChecks.map(check => check.clientId)).size;

    totalInvoicesEl.textContent = totalInvoices;
    totalOutstandingEl.textContent = `${totalOutstanding.toLocaleString()} ₪`;
    totalPaidEl.textContent = `${totalPaid.toLocaleString()} ₪`;
    paymentsThisMonthEl.textContent = `${paymentsThisMonth.toLocaleString()} ₪`;
    openInvoicesCountEl.textContent = openInvoicesCount;
    openChecksCountEl.textContent = openChecksCount;
    totalClientsEl.textContent = totalClientsCount;
    activeClientsCountEl.textContent = activeClientsCount;
}

/**
 * Renders the invoices table.
 */
function renderInvoicesTable() {
    if (!isDomReady) return;

    let filteredInvoices = invoices.filter(invoice => {
        const searchTerm = globalSearchInput.value.toLowerCase();
        if (!searchTerm) return true;
        return invoice.invoiceId.toLowerCase().includes(searchTerm) ||
            (invoice.clientName && invoice.clientName.toLowerCase().includes(searchTerm)) ||
            invoice.amount.toString().includes(searchTerm) ||
            formatDate(invoice.invoiceDate).includes(searchTerm) ||
            formatDate(invoice.dueDate).includes(searchTerm) ||
            invoice.status.toLowerCase().includes(searchTerm);
    });

    // Apply sorting
    filteredInvoices.sort((a, b) => {
        let valA, valB;

        switch (invoiceSortColumn) {
            case 'invoiceId':
            case 'clientName':
            case 'status':
            case 'paymentMethod':
                valA = String(a[invoiceSortColumn] || '').toLowerCase();
                valB = String(b[invoiceSortColumn] || '').toLowerCase();
                break;
            case 'amount':
                valA = parseFloat(a[invoiceSortColumn] || 0);
                valB = parseFloat(b[invoiceSortColumn] || 0);
                break;
            case 'invoiceDate':
            case 'dueDate':
                valA = new Date(formatDate(a[invoiceSortColumn] || ''));
                valB = new Date(formatDate(b[invoiceSortColumn] || ''));
                break;
            default:
                valA = String(a[invoiceSortColumn] || '').toLowerCase();
                valB = String(b[invoiceSortColumn] || '').toLowerCase();
        }

        if (valA < valB) return invoiceSortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return invoiceSortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    // Apply pagination
    const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
    currentPage = Math.max(1, Math.min(currentPage, totalPages || 1)); // Ensure current page is valid

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedInvoices = filteredInvoices.slice(startIndex, endIndex);

    invoiceTableBody.innerHTML = ''; // Clear existing rows

    if (paginatedInvoices.length === 0) {
        invoiceTableBody.innerHTML = '<tr><td colspan="8" class="text-center py-4">אין חשבוניות להצגה.</td></tr>';
    } else {
        paginatedInvoices.forEach(invoice => {
            const row = invoiceTableBody.insertRow();
            let rowClass = 'invoice-row-default';
            const daysDiff = getDaysDifference(formatDate(invoice.dueDate));

            if (invoice.status === 'שולם') {
                rowClass = 'invoice-row-paid';
            } else if (invoice.status === 'בפיגור') {
                rowClass = 'invoice-row-overdue';
            } else if (invoice.status === 'פתוח' && daysDiff >= 0 && daysDiff <= 7) {
                rowClass = 'invoice-row-upcoming';
            }
            row.className = rowClass;


            row.innerHTML = `
            <td>${invoice.invoiceId}</td>
            <td>${invoice.clientName || 'לקוח לא ידוע'}</td>
            <td>${parseFloat(invoice.amount || 0).toLocaleString()} ₪</td>
            <td>${displayDate(formatDate(invoice.invoiceDate))}</td>
            <td>${displayDate(formatDate(invoice.dueDate))}</td>
            <td><span class="status-badge ${invoice.status === 'שולם' ? 'paid' : invoice.status === 'בפיגור' ? 'overdue' : 'pending'}">${invoice.status}</span></td>
            <td>${invoice.paymentMethod || ''}</td>
            <td class="action-buttons">
                <button class="view-invoice-btn" data-id="${invoice.id}" title="צפה"><i class="fas fa-eye"></i></button>
                <button class="edit-invoice-btn" data-id="${invoice.id}" title="ערוך"><i class="fas fa-edit"></i></button>
                <button class="delete-invoice-btn" data-id="${invoice.id}" title="מחק"><i class="fas fa-trash"></i></button>
            </td>
        `;
        });
    }

    // Update pagination display
    currentPageSpan.textContent = currentPage;
    totalPagesSpan.textContent = totalPages;
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages || totalPages === 0;

    // Update sort icons
    invoiceTableHeaders.forEach(header => {
        const sortBy = header.dataset.sortBy;
        const sortIcon = header.querySelector('.sort-icon');
        if (sortIcon) {
            sortIcon.innerHTML = ''; // Clear existing
            if (sortBy === invoiceSortColumn) {
                sortIcon.innerHTML = invoiceSortDirection === 'asc' ? '&#9650;' : '&#9660;'; // Up or Down arrow
            }
        }
    });
}

/**
 * Renders the clients table.
 */
function renderClientsTable() {
    if (!isDomReady) return;

    let displayClients = clients.map(client => {
        const clientInvoices = invoices.filter(inv => inv.clientId === client.id);
        const totalInvoicesCount = clientInvoices.length;
        const totalOutstandingAmount = clientInvoices.filter(inv => inv.status === 'פתוח' || inv.status === 'בפיגור').reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);
        return { ...client,
            totalInvoicesCount,
            totalOutstandingAmount
        };
    });

    // Apply sorting
    displayClients.sort((a, b) => {
        let valA, valB;

        switch (clientSortColumn) {
            case 'name':
            case 'contactPerson':
            case 'email':
            case 'phone':
                valA = String(a[clientSortColumn] || '').toLowerCase();
                valB = String(b[clientSortColumn] || '').toLowerCase();
                break;
            case 'totalInvoicesCount':
            case 'totalOutstandingAmount':
                valA = parseFloat(a[clientSortColumn] || 0);
                valB = parseFloat(b[clientSortColumn] || 0);
                break;
            default:
                valA = String(a[clientSortColumn] || '').toLowerCase();
                valB = String(b[clientSortColumn] || '').toLowerCase();
        }

        if (valA < valB) return clientSortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return clientSortDirection === 'asc' ? 1 : -1;
        return 0;
    });


    clientTableBody.innerHTML = ''; // Clear existing rows

    if (displayClients.length === 0) {
        clientTableBody.innerHTML = '<tr><td colspan="7" class="text-center py-4">אין לקוחות להצגה.</td></tr>';
    } else {
        displayClients.forEach(client => {
            const row = clientTableBody.insertRow();
            row.innerHTML = `
            <td>${client.name}</td>
            <td>${client.contactPerson || ''}</td>
            <td>${client.email || ''}</td>
            <td>${client.phone || ''}</td>
            <td>${client.totalInvoicesCount}</td>
            <td>${client.totalOutstandingAmount.toLocaleString()} ₪</td>
            <td class="action-buttons">
                <button class="view-client-btn" data-id="${client.id}" title="פרטים/ערוך"><i class="fas fa-info-circle"></i></button>
                <button class="delete-client-btn" data-id="${client.id}" title="מחק"><i class="fas fa-trash"></i></button>
            </td>
        `;
        });
    }

    // Update sort icons
    clientTableHeaders.forEach(header => {
        const sortBy = header.dataset.sortBy;
        const sortIcon = header.querySelector('.sort-icon');
        if (sortIcon) {
            sortIcon.innerHTML = ''; // Clear existing
            if (sortBy === clientSortColumn) {
                sortIcon.innerHTML = clientSortDirection === 'asc' ? '&#9650;' : '&#9660;'; // Up or Down arrow
            }
        }
    });
}

/**
 * Renders the standalone checks table.
 */
function renderChecksTable() {
    if (!isDomReady) return;

    let displayChecks = standaloneChecks.map(check => {
        const client = clients.find(c => c.id === check.clientId);
        return {
            ...check,
            clientName: client ? client.name : 'לקוח לא ידוע'
        };
    });

    // Apply sorting
    displayChecks.sort((a, b) => {
        let valA, valB;

        switch (checkSortColumn) {
            case 'checkNumber':
            case 'clientName':
            case 'status':
                valA = String(a[checkSortColumn] || '').toLowerCase();
                valB = String(b[checkSortColumn] || '').toLowerCase();
                break;
            case 'amount':
                valA = parseFloat(a[checkSortColumn] || 0);
                valB = parseFloat(b[checkSortColumn] || 0);
                break;
            case 'date':
                valA = new Date(formatDate(a[checkSortColumn] || ''));
                valB = new Date(formatDate(b[checkSortColumn] || ''));
                break;
            default:
                valA = String(a[checkSortColumn] || '').toLowerCase();
                valB = String(b[checkSortColumn] || '').toLowerCase();
        }

        if (valA < valB) return checkSortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return checkSortDirection === 'asc' ? 1 : -1;
        return 0;
    });


    checksTableBody.innerHTML = ''; // Clear existing rows

    if (displayChecks.length === 0) {
        checksTableBody.innerHTML = '<tr><td colspan="6" class="text-center py-4">אין צ'קים להצגה.</td></tr>';
    } else {
        displayChecks.forEach(check => {
            const row = checksTableBody.insertRow();
            row.innerHTML = `
            <td>${check.checkNumber || ''}</td>
            <td>${check.clientName || 'לקוח לא ידוע'}</td>
            <td>${parseFloat(check.amount || 0).toLocaleString()} ₪</td>
            <td>${displayDate(formatDate(check.date))}</td>
            <td><span class="status-badge ${check.status === 'נפרע' ? 'paid' : check.status === 'חוזר' ? 'returned' : 'pending'}">${check.status || ''}</span></td>
            <td class="action-buttons">
                <button class="edit-check-btn" data-id="${check.id}" title="ערוך"><i class="fas fa-edit"></i></button>
                <button class="delete-check-btn" data-id="${check.id}" title="מחק"><i class="fas fa-trash"></i></button>
            </td>
        `;
        });
    }

    // Update sort icons
    checksTableHeaders.forEach(header => {
        const sortBy = header.dataset.sortBy;
        const sortIcon = header.querySelector('.sort-icon');
        if (sortIcon) {
            sortIcon.innerHTML = ''; // Clear existing
            if (sortBy === checkSortColumn) {
                sortIcon.innerHTML = checkSortDirection === 'asc' ? '&#9650;' : '&#9660;'; // Up or Down arrow
            }
        }
    });
}


/**
 * Populates the invoice form for editing or viewing.
 * @param {Object} invoice The invoice object.
 */
function populateInvoiceForm(invoice = {}) {
    invoiceDocIdInput.value = invoice.id || '';
    invoiceIdInput.value = invoice.invoiceId || '';
    clientInput.value = invoice.clientName || ''; // Display client name
    clientInput.dataset.clientId = invoice.clientId || ''; // Store client ID for saving
    amountInput.value = invoice.amount || '';
    invoiceDateInput.value = formatDate(invoice.invoiceDate);
    termsSelect.value = invoice.terms || '';
    dueDateInput.value = formatDate(invoice.dueDate);
    statusSelect.value = invoice.status || '';
    paymentMethodSelect.value = invoice.paymentMethod || '';

    // Clear previous checks
    checkInputsContainer.innerHTML = '';
    if (invoice.checks && invoice.checks.length > 0) {
        invoice.checks.forEach(check => addCheckInputRow(check));
        checksGroup.classList.remove('hidden');
    } else if (paymentMethodSelect.value === 'צ\'קים') {
        // If new invoice or existing without checks, and payment method is checks, show one empty row
        addCheckInputRow();
        checksGroup.classList.remove('hidden');
    } else {
        checksGroup.classList.add('hidden');
    }

    updateDueDateVisibility();
    validateInvoiceForm(); // Initial validation to show errors if any
}

/**
 * Adds an empty or pre-filled check input row to the invoice form.
 * @param {Object} [check={}] - Optional check object to pre-fill the row.
 */
function addCheckInputRow(check = {}) {
    const checkRowDiv = document.createElement('div');
    checkRowDiv.classList.add('check-input-row');
    checkRowDiv.innerHTML = `
        <div class="form-group flex-1">
            <label>מס' צ'ק:</label>
            <input type="text" class="form-input check-number-input" value="${check.checkNumber || ''}" placeholder="מס' צ'ק">
            <div class="error-message check-number-error"></div>
        </div>
        <div class="form-group flex-1">
            <label>סכום צ'ק:</label>
            <input type="number" class="form-input check-amount-input" value="${check.amount || ''}" step="0.01" placeholder="סכום צ'ק">
            <div class="error-message check-amount-error"></div>
        </div>
        <div class="form-group flex-1">
            <label>תאריך פירעון:</label>
            <input type="date" class="form-input check-date-input" value="${formatDate(check.date)}" placeholder="תאריך פירעון">
            <div class="error-message check-date-error"></div>
        </div>
        <div class="form-group flex-1">
            <label>סטטוס צ'ק:</label>
            <select class="form-select check-status-select">
                <option value="">בחר סטטוס</option>
                <option value="פתוח" ${check.status === 'פתוח' ? 'selected' : ''}>פתוח</option>
                <option value="נפרע" ${check.status === 'נפרע' ? 'selected' : ''}>נפרע</option>
                <option value="הופקד" ${check.status === 'הופקד' ? 'selected' : ''}>הופקד</option>
                <option value="חוזר" ${check.status === 'חוזר' ? 'selected' : ''}>חוזר</option>
                <option value="בוטל" ${check.status === 'בוטל' ? 'selected' : ''}>בוטל</option>
            </select>
            <div class="error-message check-status-error"></div>
        </div>
        <button type="button" class="button-danger remove-check-btn"><i class="fas fa-times"></i></button>
    `;
    checkInputsContainer.appendChild(checkRowDiv);

    // Add event listener for remove button
    checkRowDiv.querySelector('.remove-check-btn').addEventListener('click', () => {
        checkRowDiv.remove();
        validateInvoiceForm(); // Re-validate after removing a check
    });

    // Add event listeners for validation on input/change
    checkRowDiv.querySelectorAll('input, select').forEach(input => {
        input.addEventListener('input', validateInvoiceForm);
        input.addEventListener('change', validateInvoiceForm); // For date/select changes
    });
}

/**
 * Resets the invoice form to its initial state.
 */
function resetInvoiceForm() {
    invoiceForm.reset();
    invoiceDocIdInput.value = '';
    currentInvoiceDocId = null;
    invoiceModalTitle.textContent = 'הוסף חשבונית חדשה';
    clientInput.dataset.clientId = '';
    checkInputsContainer.innerHTML = ''; // Clear all check rows
    checksGroup.classList.add('hidden'); // Hide checks section
    termsWarning.classList.add('hidden'); // Hide terms warning
    // Clear error messages
    invoiceIdError.textContent = '';
    clientError.textContent = '';
    amountError.textContent = '';
    invoiceDateError.textContent = '';
    termsError.textContent = '';
    dueDateError.textContent = '';
    statusError.textContent = '';
    paymentMethodError.textContent = '';
    checksError.textContent = '';
    // Clear check input errors
    document.querySelectorAll('.check-input-row .error-message').forEach(el => el.textContent = '');
    // Set default invoice date to today
    invoiceDateInput.value = formatDate(new Date());
    updateDueDateVisibility(); // Re-evaluate due date visibility
}

/**
 * Validates the invoice form inputs.
 * @returns {boolean} True if form is valid, false otherwise.
 */
function validateInvoiceForm() {
    let isValid = true;

    // Reset errors
    invoiceIdError.textContent = '';
    clientError.textContent = '';
    amountError.textContent = '';
    invoiceDateError.textContent = '';
    termsError.textContent = '';
    dueDateError.textContent = '';
    statusError.textContent = '';
    paymentMethodError.textContent = '';
    checksError.textContent = '';
    document.querySelectorAll('.check-input-row .error-message').forEach(el => el.textContent = '');


    if (!invoiceIdInput.value.trim()) {
        invoiceIdError.textContent = 'מספר חשבונית נדרש.';
        isValid = false;
    }
    if (!clientInput.value.trim()) {
        clientError.textContent = 'שם לקוח נדרש.';
        isValid = false;
    }
    if (isNaN(parseFloat(amountInput.value)) || parseFloat(amountInput.value) <= 0) {
        amountError.textContent = 'סכום חייב להיות מספר חיובי.';
        isValid = false;
    }
    if (!invoiceDateInput.value) {
        invoiceDateError.textContent = 'תאריך חשבונית נדרש.';
        isValid = false;
    }
    if (!termsSelect.value) {
        termsError.textContent = 'תנאי תשלום נדרשים.';
        isValid = false;
    }

    // Validate Due Date only if visible
    if (!dueDateGroup.classList.contains('hidden') && !dueDateInput.value) {
        dueDateError.textContent = 'תאריך יעד נדרש.';
        isValid = false;
    }

    if (!statusSelect.value) {
        statusError.textContent = 'סטטוס נדרש.';
        isValid = false;
    }
    if (!paymentMethodSelect.value) {
        paymentMethodError.textContent = 'אופן תשלום נדרש.';
        isValid = false;
    }

    // Validate checks if payment method is 'צ'קים' and checks group is visible
    if (paymentMethodSelect.value === 'צ\'קים' && !checksGroup.classList.contains('hidden')) {
        const checkRows = checkInputsContainer.querySelectorAll('.check-input-row');
        if (checkRows.length === 0) {
            checksError.textContent = 'נדרש לפחות צ\'ק אחד עבור תשלום בצ\'קים.';
            isValid = false;
        } else {
            let allChecksValid = true;
            checkRows.forEach(row => {
                const numberInput = row.querySelector('.check-number-input');
                const amountInput = row.querySelector('.check-amount-input');
                const dateInput = row.querySelector('.check-date-input');
                const statusSelect = row.querySelector('.check-status-select');

                const numberError = row.querySelector('.check-number-error');
                const amountError = row.querySelector('.check-amount-error');
                const dateError = row.querySelector('.check-date-error');
                const statusError = row.querySelector('.check-status-error');

                numberError.textContent = '';
                amountError.textContent = '';
                dateError.textContent = '';
                statusError.textContent = '';

                if (!numberInput.value.trim()) {
                    numberError.textContent = 'מספר צ\'ק נדרש.';
                    allChecksValid = false;
                }
                if (isNaN(parseFloat(amountInput.value)) || parseFloat(amountInput.value) <= 0) {
                    amountError.textContent = 'סכום צ\'ק חייב להיות מספר חיובי.';
                    allChecksValid = false;
                }
                if (!dateInput.value) {
                    dateError.textContent = 'תאריך פירעון נדרש.';
                    allChecksValid = false;
                }
                if (!statusSelect.value) {
                    statusError.textContent = 'סטטוס צ\'ק נדרש.';
                    allChecksValid = false;
                }
            });
            if (!allChecksValid) {
                isValid = false;
            }
        }
    }

    // Enable/disable save button based on validation
    if (saveInvoiceBtn) {
        saveInvoiceBtn.disabled = !isValid;
    }

    return isValid;
}

/**
 * Updates visibility of Due Date field and terms warning based on terms select.
 */
function updateDueDateVisibility() {
    const terms = termsSelect.value;
    if (terms === 'מזומן' || terms === 'צ\'קים') {
        dueDateGroup.classList.add('hidden');
        dueDateInput.removeAttribute('required');
        termsWarning.classList.remove('hidden');
        if (terms === 'צ\'קים') {
            checksGroup.classList.remove('hidden');
            if (checkInputsContainer.children.length === 0) {
                addCheckInputRow(); // Add an empty check row if none exist
            }
        } else {
            checksGroup.classList.add('hidden');
            checkInputsContainer.innerHTML = ''; // Clear checks if not 'צ'קים'
        }
    } else {
        dueDateGroup.classList.remove('hidden');
        dueDateInput.setAttribute('required', 'required');
        termsWarning.classList.add('hidden');
        checksGroup.classList.add('hidden');
        checkInputsContainer.innerHTML = ''; // Clear checks if not 'צ'קים'
    }
    // Recalculate due date if relevant terms
    if (invoiceDateInput.value && (terms === 'שוטף' || terms === 'שוטף+30' || terms === 'שוטף+60')) {
        dueDateInput.value = calculateDueDate(invoiceDateInput.value, terms);
    } else if (!terms || terms === 'מזומן' || terms === 'צ\'קים') {
        dueDateInput.value = ''; // Clear due date if terms don't apply or empty
    }

    validateInvoiceForm(); // Re-validate after visibility change
}


/**
 * Populates the client details form for editing.
 * @param {Object} client The client object.
 */
function populateClientDetailsForm(client = {}) {
    clientDetailsDocIdInput.value = client.id || '';
    clientDetailsNameInput.value = client.name || '';
    clientDetailsContactPersonInput.value = client.contactPerson || '';
    clientDetailsEmailInput.value = client.email || '';
    clientDetailsPhoneInput.value = client.phone || '';

    // Clear previous related invoices and checks
    clientRelatedInvoicesTableBody.innerHTML = '';
    clientRelatedChecksTableBody.innerHTML = '';

    if (client.id) {
        const relatedInvoices = invoices.filter(inv => inv.clientId === client.id);
        if (relatedInvoices.length > 0) {
            relatedInvoices.forEach(inv => {
                const row = clientRelatedInvoicesTableBody.insertRow();
                row.innerHTML = `
                    <td>${inv.invoiceId}</td>
                    <td>${parseFloat(inv.amount || 0).toLocaleString()} ₪</td>
                    <td>${displayDate(formatDate(inv.dueDate))}</td>
                    <td><span class="status-badge ${inv.status === 'שולם' ? 'paid' : inv.status === 'בפיגור' ? 'overdue' : 'pending'}">${inv.status}</span></td>
                    <td class="action-buttons">
                        <button class="view-invoice-btn" data-id="${inv.id}" title="צפה"><i class="fas fa-eye"></i></button>
                    </td>
                `;
            });
        } else {
            clientRelatedInvoicesTableBody.innerHTML = '<tr><td colspan="5" class="text-center py-2">אין חשבוניות קשורות.</td></tr>';
        }

        const relatedChecks = standaloneChecks.filter(check => check.clientId === client.id);
        if (relatedChecks.length > 0) {
            relatedChecks.forEach(check => {
                const row = clientRelatedChecksTableBody.insertRow();
                row.innerHTML = `
                    <td>${check.checkNumber || ''}</td>
                    <td>${parseFloat(check.amount || 0).toLocaleString()} ₪</td>
                    <td>${displayDate(formatDate(check.date))}</td>
                    <td><span class="status-badge ${check.status === 'נפרע' ? 'paid' : check.status === 'חוזר' ? 'returned' : 'pending'}">${check.status || ''}</span></td>
                    <td class="action-buttons">
                        <button class="edit-check-btn" data-id="${check.id}" title="ערוך"><i class="fas fa-edit"></i></button>
                    </td>
                `;
            });
        } else {
            clientRelatedChecksTableBody.innerHTML = '<tr><td colspan="5" class="text-center py-2">אין צ\'קים קשורים.</td></tr>';
        }

        deleteClientBtn.classList.remove('hidden'); // Show delete button for existing client
    } else {
        deleteClientBtn.classList.add('hidden'); // Hide delete button for new client
    }

    validateClientDetailsForm();
}

/**
 * Resets the client details form.
 */
function resetClientDetailsForm() {
    clientDetailsForm.reset();
    clientDetailsDocIdInput.value = '';
    currentClientDocId = null;
    clientDetailsModalTitle.textContent = 'הוסף לקוח חדש';
    clientDetailsNameError.textContent = '';
    clientRelatedInvoicesTableBody.innerHTML = '';
    clientRelatedChecksTableBody.innerHTML = '';
    deleteClientBtn.classList.add('hidden'); // Hide delete button
}

/**
 * Validates the client details form inputs.
 * @returns {boolean} True if form is valid, false otherwise.
 */
function validateClientDetailsForm() {
    let isValid = true;
    clientDetailsNameError.textContent = '';

    if (!clientDetailsNameInput.value.trim()) {
        clientDetailsNameError.textContent = 'שם לקוח נדרש.';
        isValid = false;
    }

    saveClientDetailsBtn.disabled = !isValid;
    return isValid;
}

/**
 * Populates the standalone check form for editing.
 * @param {Object} check The check object.
 */
function populateStandaloneCheckForm(check = {}) {
    standaloneCheckDocIdInput.value = check.id || '';
    standaloneCheckNumberInput.value = check.checkNumber || '';
    standaloneCheckClientInput.value = check.clientName || ''; // Display client name
    standaloneCheckClientInput.dataset.clientId = check.clientId || ''; // Store client ID
    standaloneCheckAmountInput.value = check.amount || '';
    standaloneCheckDateInput.value = formatDate(check.date);
    standaloneCheckStatusSelect.value = check.status || '';

    addEditCheckModalTitle.textContent = check.id ? 'ערוך צ\'ק עצמאי' : 'הוסף צ\'ק עצמאי';
    if (check.id) {
        deleteStandaloneCheckBtn.classList.remove('hidden');
    } else {
        deleteStandaloneCheckBtn.classList.add('hidden');
    }

    validateStandaloneCheckForm();
}

/**
 * Resets the standalone check form.
 */
function resetStandaloneCheckForm() {
    standaloneCheckForm.reset();
    standaloneCheckDocIdInput.value = '';
    currentStandaloneCheckDocId = null;
    standaloneCheckClientInput.dataset.clientId = '';
    standaloneCheckNumberError.textContent = '';
    standaloneCheckClientError.textContent = '';
    standaloneCheckAmountError.textContent = '';
    standaloneCheckDateError.textContent = '';
    standaloneCheckStatusError.textContent = '';
    deleteStandaloneCheckBtn.classList.add('hidden'); // Hide delete button
    addEditCheckModalTitle.textContent = 'הוסף צ\'ק עצמאי';
}

/**
 * Validates the standalone check form inputs.
 * @returns {boolean} True if form is valid, false otherwise.
 */
function validateStandaloneCheckForm() {
    let isValid = true;

    standaloneCheckNumberError.textContent = '';
    standaloneCheckClientError.textContent = '';
    standaloneCheckAmountError.textContent = '';
    standaloneCheckDateError.textContent = '';
    standaloneCheckStatusError.textContent = '';

    if (!standaloneCheckNumberInput.value.trim()) {
        standaloneCheckNumberError.textContent = 'מספר צ\'ק נדרש.';
        isValid = false;
    }
    if (!standaloneCheckClientInput.value.trim()) {
        standaloneCheckClientError.textContent = 'שם לקוח נדרש.';
        isValid = false;
    }
    if (isNaN(parseFloat(standaloneCheckAmountInput.value)) || parseFloat(standaloneCheckAmountInput.value) <= 0) {
        standaloneCheckAmountError.textContent = 'סכום חייב להיות מספר חיובי.';
        isValid = false;
    }
    if (!standaloneCheckDateInput.value) {
        standaloneCheckDateError.textContent = 'תאריך פירעון נדרש.';
        isValid = false;
    }
    if (!standaloneCheckStatusSelect.value) {
        standaloneCheckStatusError.textContent = 'סטטוס צ\'ק נדרש.';
        isValid = false;
    }

    if (saveStandaloneCheckBtn) {
        saveStandaloneCheckBtn.disabled = !isValid;
    }

    return isValid;
}

// --- Alert and Notification Functions ---

/**
 * Updates the alerts section based on current data.
 */
function updateAlerts() {
    if (!isDomReady) return;

    const today = formatDate(new Date());
    const sevenDaysFromNow = formatDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

    const overdueInvoices = invoices.filter(inv => inv.status === 'בפיגור');
    const invoicesDueToday = invoices.filter(inv => inv.status === 'פתוח' && formatDate(inv.dueDate) === today);
    const invoicesDueSoon = invoices.filter(inv => inv.status === 'פתוח' && formatDate(inv.dueDate) > today && formatDate(inv.dueDate) <= sevenDaysFromNow);

    const checksDueToday = standaloneChecks.filter(check => check.status === 'פתוח' && formatDate(check.date) === today);
    const checksDueSoon = standaloneChecks.filter(check => check.status === 'פתוח' && formatDate(check.date) > today && formatDate(check.date) <= sevenDaysFromNow);

    // Inactive clients: no invoices or standalone checks in the last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const inactiveClients = clients.filter(client => {
        const clientInvoices = invoices.filter(inv => inv.clientId === client.id);
        const clientChecks = standaloneChecks.filter(check => check.clientId === client.id);

        const latestInvoiceActivity = clientInvoices.reduce((latest, inv) => {
            const invDate = inv.updatedAt ? (inv.updatedAt.toDate ? inv.updatedAt.toDate() : new Date(inv.updatedAt)) : new Date(inv.createdAt);
            return invDate > latest ? invDate : latest;
        }, new Date(0)); // Start with epoch

        const latestCheckActivity = clientChecks.reduce((latest, check) => {
            const checkDate = check.updatedAt ? (check.updatedAt.toDate ? check.updatedAt.toDate() : new Date(check.updatedAt)) : new Date(check.createdAt);
            return checkDate > latest ? checkDate : latest;
        }, new Date(0));

        const latestActivity = latestInvoiceActivity > latestCheckActivity ? latestInvoiceActivity : latestCheckActivity;
        return latestActivity < sixMonthsAgo;
    });

    // Update counts
    overdueCount.textContent = overdueInvoices.length;
    dueTodayCount.textContent = invoicesDueToday.length;
    dueSoonCount.textContent = invoicesDueSoon.length;
    checksDueTodayCount.textContent = checksDueToday.length;
    checksDueSoonCount.textContent = checksDueSoon.length;
    inactiveClientsCount.textContent = inactiveClients.length;

    // Populate lists
    populateAlertList(overdueInvoicesList, overdueInvoices, 'invoice');
    populateAlertList(invoicesDueTodayList, invoicesDueToday, 'invoice');
    populateAlertList(invoicesDueSoonList, invoicesDueSoon, 'invoice');
    populateAlertList(checksDueTodayList, checksDueToday, 'check');
    populateAlertList(checksDueSoonList, checksDueSoon, 'check');
    populateAlertList(inactiveClientsList, inactiveClients, 'client');


    const totalAlerts = overdueInvoices.length + invoicesDueToday.length + invoicesDueSoon.length + checksDueToday.length + checksDueSoon.length + inactiveClients.length;
    if (totalAlerts > 0) {
        alertCountBadge.textContent = totalAlerts;
        alertCountBadge.classList.remove('hidden');
        navAlertsBtn.classList.add('alerts-blink');
        if (Notification.permission === "granted") {
            sendNotifications(overdueInvoices, invoicesDueToday, checksDueToday);
        }
    } else {
        alertCountBadge.classList.add('hidden');
        navAlertsBtn.classList.remove('alerts-blink');
    }
}

/**
 * Populates a given alert list (UL element).
 * @param {HTMLElement} listElement The UL element to populate.
 * @param {Array<Object>} items The array of items (invoices, checks, or clients).
 * @param {'invoice'|'check'|'client'} type The type of items.
 */
function populateAlertList(listElement, items, type) {
    listElement.innerHTML = '';
    if (items.length === 0) {
        const li = document.createElement('li');
        li.textContent = `אין ${type === 'invoice' ? 'חשבוניות' : type === 'check' ? 'צ\'קים' : 'לקוחות'} מסוג זה כרגע.`;
        listElement.appendChild(li);
        return;
    }

    items.forEach(item => {
        const li = document.createElement('li');
        let text = '';
        let actionBtn = '';
        let details = '';

        if (type === 'invoice') {
            const daysUntil = getDaysDifference(formatDate(item.dueDate));
            const client = clients.find(c => c.id === item.clientId);
            const clientName = client ? client.name : 'לקוח לא ידוע';
            details = `מס' חשבונית: ${item.invoiceId}, לקוח: ${clientName}, סכום: ${parseFloat(item.amount).toLocaleString()} ₪, תאריך יעד: ${displayDate(formatDate(item.dueDate))}`;
            if (item.status === 'בפיגור') {
                text = `חשבונית ${item.invoiceId} של ${clientName} בסך ${parseFloat(item.amount).toLocaleString()} ₪ בפיגור (${Math.abs(daysUntil)} ימים)`;
            } else if (daysUntil === 0) {
                text = `חשבונית ${item.invoiceId} של ${clientName} בסך ${parseFloat(item.amount).toLocaleString()} ₪ לתשלום היום!`;
            } else if (daysUntil > 0) {
                text = `חשבונית ${item.invoiceId} של ${clientName} בסך ${parseFloat(item.amount).toLocaleString()} ₪ לתשלום בעוד ${daysUntil} ימים.`;
            }
            actionBtn = `<button class="button-info button-small view-invoice-btn" data-id="${item.id}" title="צפה"><i class="fas fa-eye"></i></button>`;
        } else if (type === 'check') {
            const daysUntil = getDaysDifference(formatDate(item.date));
            const client = clients.find(c => c.id === item.clientId);
            const clientName = client ? client.name : 'לקוח לא ידוע';
            details = `מס' צ'ק: ${item.checkNumber}, לקוח: ${clientName}, סכום: ${parseFloat(item.amount).toLocaleString()} ₪, תאריך פירעון: ${displayDate(formatDate(item.date))}`;
            if (daysUntil === 0) {
                text = `צ'ק מספר ${item.checkNumber} של ${clientName} בסך ${parseFloat(item.amount).toLocaleString()} ₪ לפירעון היום!`;
            } else if (daysUntil > 0) {
                text = `צ'ק מספר ${item.checkNumber} של ${clientName} בסך ${parseFloat(item.amount).toLocaleString()} ₪ לפירעון בעוד ${daysUntil} ימים.`;
            }
            actionBtn = `<button class="button-info button-small edit-check-btn" data-id="${item.id}" title="ערוך"><i class="fas fa-edit"></i></button>`;
        } else if (type === 'client') {
            const lastActivityDate = item.updatedAt ? (item.updatedAt.toDate ? item.updatedAt.toDate() : new Date(item.updatedAt)) : new Date(item.createdAt);
            text = `לקוח ${item.name} לא פעיל מאז ${displayDate(formatDate(lastActivityDate))}.`;
            actionBtn = `<button class="button-info button-small view-client-btn" data-id="${item.id}" title="פרטים"><i class="fas fa-info-circle"></i></button>`;
        }

        li.innerHTML = `${text} ${actionBtn}`;
        listElement.appendChild(li);
    });
}

/**
 * Sends browser notifications for overdue invoices and those due today.
 * @param {Array} overdueInvoices
 * @param {Array} invoicesDueToday
 * @param {Array} checksDueToday
 */
function sendNotifications(overdueInvoices, invoicesDueToday, checksDueToday) {
    if (!("Notification" in window)) {
        console.warn("This browser does not support desktop notification");
        return;
    }

    if (Notification.permission === "granted") {
        overdueInvoices.forEach(inv => {
            const client = clients.find(c => c.id === inv.clientId);
            const clientName = client ? client.name : 'לקוח לא ידוע';
            new Notification('חשבונית בפיגור!', {
                body: `חשבונית ${inv.invoiceId} של ${clientName} בסך ${parseFloat(inv.amount).toLocaleString()} ₪ בפיגור.`
            });
        });

        invoicesDueToday.forEach(inv => {
            const client = clients.find(c => c.id === inv.clientId);
            const clientName = client ? client.name : 'לקוח לא ידוע';
            new Notification('חשבונית לתשלום היום!', {
                body: `חשבונית ${inv.invoiceId} של ${clientName} בסך ${parseFloat(inv.amount).toLocaleString()} ₪ לתשלום היום.`
            });
        });

        checksDueToday.forEach(check => {
            const client = clients.find(c => c.id === check.clientId);
            const clientName = client ? client.name : 'לקוח לא ידוע';
            new Notification('צ\'ק לפירעון היום!', {
                body: `צ\'ק מספר ${check.checkNumber} של ${clientName} בסך ${parseFloat(check.amount).toLocaleString()} ₪ לפירעון היום.`
            });
        });
    }
}


// --- CSV Export Functions ---

/**
 * Exports invoice data to CSV.
 */
function exportInvoicesToCsv() {
    if (invoices.length === 0) {
        showToast("אין חשבוניות לייצוא.", 'info');
        return;
    }

    const headers = ["מספר חשבונית", "שם לקוח", "סכום", "תאריך חשבונית", "תאריך יעד", "סטטוס", "אופן תשלום", "מספרי צ'קים", "סכומי צ'קים", "תאריכי פירעון צ'קים", "סטטוסי צ'קים"];
    const rows = invoices.map(inv => {
        const client = clients.find(c => c.id === inv.clientId);
        const clientName = client ? client.name : 'לקוח לא ידוע';

        const checkNumbers = (inv.checks || []).map(c => c.checkNumber || '').join(';');
        const checkAmounts = (inv.checks || []).map(c => c.amount || 0).join(';');
        const checkDates = (inv.checks || []).map(c => formatDate(c.date) || '').join(';');
        const checkStatuses = (inv.checks || []).map(c => c.status || '').join(';');

        return [
            `"${inv.invoiceId || ''}"`,
            `"${clientName}"`,
            inv.amount || 0,
            `"${displayDate(formatDate(inv.invoiceDate))}"`,
            `"${displayDate(formatDate(inv.dueDate))}"`,
            `"${inv.status || ''}"`,
            `"${inv.paymentMethod || ''}"`,
            `"${checkNumbers}"`,
            `"${checkAmounts}"`,
            `"${checkDates}"`,
            `"${checkStatuses}"`
        ].join(',');
    });

    const csvContent = `${headers.join(',')}\n${rows.join('\n')}`;
    downloadCsv('חשבוניות.csv', csvContent);
    showToast("חשבוניות יוצאו בהצלחה ל-CSV.", 'success');
}

/**
 * Exports client data to CSV.
 */
function exportClientsToCsv() {
    if (clients.length === 0) {
        showToast("אין לקוחות לייצוא.", 'info');
        return;
    }

    const headers = ["שם לקוח", "איש קשר", "אימייל", "טלפון", "סה\"כ חשבוניות", "חוב פתוח"];
    const rows = clients.map(client => {
        const clientInvoices = invoices.filter(inv => inv.clientId === client.id);
        const totalInvoicesCount = clientInvoices.length;
        const totalOutstandingAmount = clientInvoices.filter(inv => inv.status === 'פתוח' || inv.status === 'בפיגור').reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);

        return [
            `"${client.name || ''}"`,
            `"${client.contactPerson || ''}"`,
            `"${client.email || ''}"`,
            `"${client.phone || ''}"`,
            totalInvoicesCount,
            totalOutstandingAmount
        ].join(',');
    });

    const csvContent = `${headers.join(',')}\n${rows.join('\n')}`;
    downloadCsv('לקוחות.csv', csvContent);
    showToast("לקוחות יוצאו בהצלחה ל-CSV.", 'success');
}

/**
 * Exports standalone check data to CSV.
 */
function exportChecksToCsv() {
    if (standaloneChecks.length === 0) {
        showToast("אין צ'קים לייצוא.", 'info');
        return;
    }

    const headers = ["מספר צ'ק", "שם לקוח", "סכום", "תאריך פירעון", "סטטוס"];
    const rows = standaloneChecks.map(check => {
        const client = clients.find(c => c.id === check.clientId);
        const clientName = client ? client.name : 'לקוח לא ידוע';

        return [
            `"${check.checkNumber || ''}"`,
            `"${clientName}"`,
            check.amount || 0,
            `"${displayDate(formatDate(check.date))}"`,
            `"${check.status || ''}"`,
        ].join(',');
    });

    const csvContent = `${headers.join(',')}\n${rows.join('\n')}`;
    downloadCsv('צקים.csv', csvContent);
    showToast("צ'קים יוצאו בהצלחה ל-CSV.", 'success');
}

/**
 * Triggers a CSV file download.
 * @param {string} filename
 * @param {string} content
 */
function downloadCsv(filename, content) {
    const blob = new Blob(["\uFEFF", content], {
        type: "text/csv;charset=utf-8;"
    });
    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}


// --- Event Listeners and Initial Setup ---

document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM Content Loaded.');
    isDomReady = true;
    // Assign DOM elements
    dashboardPage = document.getElementById('dashboardPage');
    invoicesPage = document.getElementById('invoicesPage');
    clientsPage = document.getElementById('clientsPage');
    alertsPage = document.getElementById('alertsPage');
    checksPage = document.getElementById('checksPage');

    totalInvoicesEl = document.getElementById('totalInvoicesEl');
    totalOutstandingEl = document.getElementById('totalOutstandingEl');
    totalPaidEl = document.getElementById('totalPaidEl');
    paymentsThisMonthEl = document.getElementById('paymentsThisMonthEl');
    openInvoicesCountEl = document.getElementById('openInvoicesCountEl');
    openChecksCountEl = document.getElementById('openChecksCountEl');
    totalClientsEl = document.getElementById('totalClientsEl');
    activeClientsCountEl = document.getElementById('activeClientsCountEl');
    addInvoiceDashboardBtn = document.getElementById('addInvoiceDashboardBtn');

    globalSearchInput = document.getElementById('globalSearchInput');
    userIdDisplay = document.getElementById('userIdDisplay');
    logoutBtn = document.getElementById('logoutBtn');

    exportCsvBtn = document.getElementById('exportCsvBtn');
    addInvoiceBtn = document.getElementById('addInvoiceBtn');
    invoiceTableBody = document.getElementById('invoiceTableBody');
    prevPageBtn = document.getElementById('prevPageBtn');
    nextPageBtn = document.getElementById('nextPageBtn');
    currentPageSpan = document.getElementById('currentPageSpan');
    totalPagesSpan = document.getElementById('totalPagesSpan');
    invoiceTableHeaders = document.querySelectorAll('#invoicesPage .data-table th[data-sort-by]');

    invoiceModal = document.getElementById('invoiceModal');
    invoiceModalTitle = document.getElementById('invoiceModalTitle');
    closeInvoiceModalBtn = invoiceModal.querySelector('.modal-close-btn');
    cancelInvoiceBtn = document.getElementById('cancelInvoiceBtn');
    invoiceForm = document.getElementById('invoiceForm');
    saveInvoiceBtn = document.getElementById('saveInvoiceBtn');

    viewInvoiceModal = document.getElementById('viewInvoiceModal');
    closeViewInvoiceModalBtn = viewInvoiceModal.querySelector('.modal-close-btn');
    printInvoiceBtn = document.getElementById('printInvoiceBtn');
    editInvoiceBtn = document.getElementById('editInvoiceBtn');
    deleteInvoiceBtn = document.getElementById('deleteInvoiceBtn');

    invoiceDocIdInput = document.getElementById('invoiceDocIdInput');
    invoiceIdInput = document.getElementById('invoiceIdInput');
    clientInput = document.getElementById('clientInput');
    clientSuggestionsDiv = document.getElementById('clientSuggestionsDiv');
    amountInput = document.getElementById('amountInput');
    invoiceDateInput = document.getElementById('invoiceDateInput');
    termsSelect = document.getElementById('termsSelect');
    termsWarning = document.getElementById('termsWarning');
    dueDateGroup = document.getElementById('dueDateGroup');
    dueDateInput = document.getElementById('dueDateInput');
    statusSelect = document.getElementById('statusSelect');
    paymentMethodSelect = document.getElementById('paymentMethodSelect');
    checksGroup = document.getElementById('checksGroup');
    checkInputsContainer = document.getElementById('checkInputsContainer');
    addCheckBtn = document.getElementById('addCheckBtn');

    invoiceIdError = document.getElementById('invoiceIdError');
    clientError = document.getElementById('clientError');
    amountError = document.getElementById('amountError');
    invoiceDateError = document.getElementById('invoiceDateError');
    termsError = document.getElementById('termsError');
    dueDateError = document.getElementById('dueDateError');
    statusError = document.getElementById('statusError');
    paymentMethodError = document.getElementById('paymentMethodError');
    checksError = document.getElementById('checksError');

    clientSearchInput = document.getElementById('clientSearchInput'); // This element doesn't exist in HTML
    addClientBtnClientPage = document.getElementById('addClientBtnClientPage');
    exportClientsCsvBtn = document.getElementById('exportClientsCsvBtn');
    clientTableBody = document.getElementById('clientTableBody');
    clientTableHeaders = document.querySelectorAll('#clientsPage .data-table th[data-sort-by]');


    clientDetailsModal = document.getElementById('clientDetailsModal');
    clientDetailsModalTitle = document.getElementById('clientDetailsModalTitle');
    closeClientDetailsModalBtn = clientDetailsModal.querySelector('.modal-close-btn');
    clientDetailsForm = document.getElementById('clientDetailsForm');
    cancelClientDetailsBtn = document.getElementById('cancelClientDetailsBtn');
    saveClientDetailsBtn = document.getElementById('saveClientDetailsBtn');

    clientDetailsDocIdInput = document.getElementById('clientDetailsDocIdInput');
    clientDetailsNameInput = document.getElementById('clientDetailsNameInput');
    clientDetailsContactPersonInput = document.getElementById('clientDetailsContactPersonInput');
    clientDetailsEmailInput = document.getElementById('clientDetailsEmailInput');
    clientDetailsPhoneInput = document.getElementById('clientDetailsPhoneInput');
    clientDetailsNameError = document.getElementById('clientDetailsNameError');
    clientRelatedInvoicesTableBody = document.getElementById('clientRelatedInvoicesTableBody');
    clientRelatedChecksTableBody = document.getElementById('clientRelatedChecksTableBody');
    deleteClientBtn = document.getElementById('deleteClientBtn');

    addStandaloneCheckBtn = document.getElementById('addStandaloneCheckBtn');
    exportChecksCsvBtn = document.getElementById('exportChecksCsvBtn');
    checksTableBody = document.getElementById('checksTableBody');
    checksTableHeaders = document.querySelectorAll('#checksPage .data-table th[data-sort-by]');


    addEditCheckModal = document.getElementById('addEditCheckModal');
    addEditCheckModalTitle = document.getElementById('addEditCheckModalTitle');
    closeAddEditCheckModalBtn = addEditCheckModal.querySelector('.modal-close-btn');
    standaloneCheckForm = document.getElementById('standaloneCheckForm');
    cancelStandaloneCheckBtn = document.getElementById('cancelStandaloneCheckBtn');
    saveStandaloneCheckBtn = document.getElementById('saveStandaloneCheckBtn');

    standaloneCheckDocIdInput = document.getElementById('standaloneCheckDocIdInput');
    standaloneCheckNumberInput = document.getElementById('standaloneCheckNumberInput');
    standaloneCheckClientInput = document.getElementById('standaloneCheckClientInput');
    standaloneClientSuggestionsDiv = document.getElementById('standaloneClientSuggestionsDiv');
    standaloneCheckAmountInput = document.getElementById('standaloneCheckAmountInput');
    standaloneCheckDateInput = document.getElementById('standaloneCheckDateInput');
    standaloneCheckStatusSelect = document.getElementById('standaloneCheckStatusSelect');

    standaloneCheckNumberError = document.getElementById('standaloneCheckNumberError');
    standaloneCheckClientError = document.getElementById('standaloneCheckClientError');
    standaloneCheckAmountError = document.getElementById('standaloneCheckAmountError');
    standaloneCheckDateError = document.getElementById('standaloneCheckDateError');
    standaloneCheckStatusError = document.getElementById('standaloneCheckStatusError');
    deleteStandaloneCheckBtn = document.getElementById('deleteStandaloneCheckBtn');

    requestNotificationPermissionBtn = document.getElementById('requestNotificationPermissionBtn');
    overdueInvoicesList = document.getElementById('overdueInvoicesList');
    invoicesDueTodayList = document.getElementById('invoicesDueTodayList');
    invoicesDueSoonList = document.getElementById('invoicesDueSoonList');
    checksDueTodayList = document.getElementById('checksDueTodayList');
    checksDueSoonList = document.getElementById('checksDueSoonList');
    inactiveClientsList = document.getElementById('inactiveClientsList');
    alertCountBadge = document.getElementById('alertCountBadge');
    navAlertsBtn = document.getElementById('navAlertsBtn');

    confirmModal = document.getElementById('confirmModal');
    confirmModalTitle = document.getElementById('confirmModalTitle');
    confirmModalMessage = document.getElementById('confirmModalMessage');
    cancelConfirmBtn = document.getElementById('cancelConfirmBtn');
    confirmActionBtn = document.getElementById('confirmActionBtn');
    toast = document.getElementById('toast');
    loadingOverlay = document.getElementById('loadingOverlay');

    // Initial setup
    showPage(dashboardPage);
    invoiceDateInput.value = formatDate(new Date()); // Set default invoice date to today

    // Initialize Firebase
    console.log('Initializing Firebase app...');
    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        console.log('Firebase app, auth, firestore initialized.');
    } catch (e) {
        console.error("Firebase initialization failed:", e);
        showToast("שגיאה באתחול Firebase: " + e.message, 'error');
        return; // Stop execution if Firebase fails
    }


    // Handle authentication state changes
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUserId = user.uid;
            userDisplayName = user.isAnonymous ? 'אנונימי' : (user.displayName || user.email || 'משתמש');
            console.log('User signed in:', currentUserId, userDisplayName);
            if (userIdDisplay) {
                userIdDisplay.textContent = `UID: ${currentUserId.substring(0, 8)}...`;
            }
            isAuthReady = true;
            // Start listening to data only after authentication is ready
            listenForInvoices();
            listenForClients();
            listenForStandaloneChecks();
        } else {
            console.log('No user signed in. Attempting anonymous sign-in...');
            currentUserId = null;
            userDisplayName = 'אנונימי';
            userIdDisplay.textContent = 'לא מחובר';
            isAuthReady = false;
            // Clear data if no user
            invoices = [];
            clients = [];
            standaloneChecks = [];
            updateDashboard();
            renderInvoicesTable();
            renderClientsTable();
            renderChecksTable();
            updateAlerts();

            // Attempt anonymous sign-in
            try {
                await signInAnonymously(auth);
                console.log('Anonymous user signed in successfully.');
                showToast('התחברת בהצלחה (אנונימי)', 'success');
            } catch (error) {
                console.error("Anonymous sign-in failed:", error);
                showToast("שגיאה בהתחברות אנונימית: " + error.message, 'error');
            }
        }
    });

    // --- Event Listeners ---

    // Sidebar Navigation
    document.querySelectorAll('.sidebar-nav button').forEach(button => {
        button.addEventListener('click', () => {
            if (button.id === 'logoutBtn') {
                showConfirmModal(
                    'התנתקות',
                    'האם אתה בטוח שברצונך להתנתק? נתונים מקומיים ימחקו.',
                    async () => {
                        showLoading();
                        try {
                            await signOut(auth);
                            showToast('התנתקת בהצלחה!', 'success');
                        } catch (error) {
                            console.error("Error signing out:", error);
                            showToast("שגיאה בהתנתקות: " + error.message, 'error');
                        } finally {
                            hideLoading();
                        }
                    },
                    'התנתק',
                    'button-danger'
                );
            } else if (button.dataset.page) {
                showPage(document.getElementById(button.dataset.page));
            }
        });
    });

    // Dashboard Card Click Handlers
    document.querySelectorAll('.dashboard-card').forEach(card => {
        card.addEventListener('click', () => {
            const targetPageId = card.dataset.targetPage;
            const filter = card.dataset.filter;
            if (targetPageId && document.getElementById(targetPageId)) {
                showPage(document.getElementById(targetPageId));
                // Apply filter to global search input if target page supports it
                if (globalSearchInput && (targetPageId === 'invoicesPage' || targetPageId === 'clientsPage' || targetPageId === 'checksPage')) {
                    let searchTerm = '';
                    if (filter === 'unpaid' || filter === 'open') searchTerm = 'פתוח';
                    if (filter === 'paid') searchTerm = 'שולם';
                    if (filter === 'thisMonthPaid') {
                        const currentYear = new Date().getFullYear();
                        const currentMonth = (new Date().getMonth() + 1).toString().padStart(2, '0');
                        searchTerm = `${currentYear}-${currentMonth}`; // Filter by YYYY-MM in date
                    }
                    if (filter === 'active') searchTerm = ''; // Active clients implies no specific search
                    globalSearchInput.value = searchTerm;
                    // Trigger render manually for client page after filter, as client search is on change
                    if (targetPageId === 'invoicesPage') renderInvoicesTable();
                    if (targetPageId === 'clientsPage') renderClientsTable();
                    if (targetPageId === 'checksPage') renderChecksTable();
                }
            }
        });
    });

    // Global Search
    globalSearchInput.addEventListener('input', () => {
        const activePage = document.querySelector('.content-page.active');
        if (activePage === invoicesPage) renderInvoicesTable();
        if (activePage === clientsPage) renderClientsTable();
        if (activePage === checksPage) renderChecksTable();
    });

    // Invoice Actions
    addInvoiceDashboardBtn.addEventListener('click', () => {
        resetInvoiceForm();
        invoiceModalTitle.textContent = 'הוסף חשבונית חדשה';
        showModal(invoiceModal);
    });
    addInvoiceBtn.addEventListener('click', () => {
        resetInvoiceForm();
        invoiceModalTitle.textContent = 'הוסף חשבונית חדשה';
        showModal(invoiceModal);
    });
    cancelInvoiceBtn.addEventListener('click', () => hideModal(invoiceModal));
    closeInvoiceModalBtn.addEventListener('click', () => hideModal(invoiceModal));

    invoiceForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!validateInvoiceForm()) {
            showToast('אנא מלא את כל השדות הנדרשים כראוי.', 'error');
            return;
        }

        const invoiceId = invoiceIdInput.value.trim();
        const clientId = clientInput.dataset.clientId; // Get ID from dataset
        const clientName = clientInput.value.trim(); // Get name from input
        const amount = parseFloat(amountInput.value);
        const invoiceDate = invoiceDateInput.value;
        const terms = termsSelect.value;
        const dueDate = dueDateInput.value;
        const status = statusSelect.value;
        const paymentMethod = paymentMethodSelect.value;

        // Gather check details if payment method is 'צ'קים'
        const checks = [];
        if (paymentMethod === 'צ\'קים') {
            const checkRows = checkInputsContainer.querySelectorAll('.check-input-row');
            checkRows.forEach(row => {
                const checkNumber = row.querySelector('.check-number-input').value.trim();
                const checkAmount = parseFloat(row.querySelector('.check-amount-input').value);
                const checkDate = row.querySelector('.check-date-input').value;
                const checkStatus = row.querySelector('.check-status-select').value;
                checks.push({
                    checkNumber,
                    amount: checkAmount,
                    date: checkDate,
                    status: checkStatus
                });
            });
        }

        const invoiceData = {
            invoiceId,
            clientId,
            clientName,
            amount,
            invoiceDate,
            terms,
            dueDate,
            status,
            paymentMethod,
            checks
        };

        await saveInvoice(invoiceData, invoiceDocIdInput.value || null);
    });

    // Invoice form field change listeners for validation and due date calculation
    invoiceIdInput.addEventListener('input', validateInvoiceForm);
    amountInput.addEventListener('input', validateInvoiceForm);
    invoiceDateInput.addEventListener('change', updateDueDateVisibility); // Change fires after date picked
    termsSelect.addEventListener('change', updateDueDateVisibility);
    dueDateInput.addEventListener('change', validateInvoiceForm);
    statusSelect.addEventListener('change', validateInvoiceForm);
    paymentMethodSelect.addEventListener('change', updateDueDateVisibility);
    clientInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        clientSuggestionsDiv.innerHTML = '';
        clientInput.dataset.clientId = ''; // Clear client ID when typing
        if (searchTerm.length > 0) {
            const filteredClients = clients.filter(c => c.name.toLowerCase().includes(searchTerm));
            filteredClients.forEach(client => {
                const suggestionDiv = document.createElement('div');
                suggestionDiv.textContent = client.name;
                suggestionDiv.dataset.clientId = client.id; // Store client ID
                suggestionDiv.addEventListener('click', () => {
                    clientInput.value = client.name;
                    clientInput.dataset.clientId = client.id;
                    clientSuggestionsDiv.innerHTML = ''; // Hide suggestions
                    validateInvoiceForm(); // Re-validate after selecting client
                });
                clientSuggestionsDiv.appendChild(suggestionDiv);
            });
        }
        validateInvoiceForm(); // Validate if client input is empty
    });
    clientInput.addEventListener('blur', () => {
        // Hide suggestions after a short delay to allow click on suggestion
        setTimeout(() => {
            clientSuggestionsDiv.innerHTML = '';
        }, 200);
    });

    addCheckBtn.addEventListener('click', () => addCheckInputRow());

    // Delegation for invoice table buttons
    invoiceTableBody.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        const invoiceId = target.dataset.id;
        const invoice = invoices.find(inv => inv.id === invoiceId);
        if (!invoice) {
            showToast('חשבונית לא נמצאה.', 'error');
            return;
        }

        if (target.classList.contains('view-invoice-btn')) {
            currentInvoiceDocId = invoice.id; // Set for print/edit/delete buttons in view modal
            populateViewInvoiceModal(invoice);
            showModal(viewInvoiceModal);
        } else if (target.classList.contains('edit-invoice-btn')) {
            currentInvoiceDocId = invoice.id;
            invoiceModalTitle.textContent = 'ערוך חשבונית';
            populateInvoiceForm(invoice);
            showModal(invoiceModal);
        } else if (target.classList.contains('delete-invoice-btn')) {
            showConfirmModal(
                'מחק חשבונית',
                `האם אתה בטוח שברצונך למחוק את חשבונית מספר ${invoice.invoiceId}? פעולה זו בלתי הפיכה ותמחק גם צ'קים הקשורים לחשבונית זו.`,
                () => deleteInvoice(invoice.id),
                'מחק',
                'button-danger'
            );
        }
    });

    // View Invoice Modal Actions
    closeViewInvoiceModalBtn.addEventListener('click', () => hideModal(viewInvoiceModal));
    printInvoiceBtn.addEventListener('click', () => {
        // Implement print functionality here
        showToast('פונקציית הדפסה תתווסף בהמשך.', 'info');
    });
    editInvoiceBtn.addEventListener('click', () => {
        hideModal(viewInvoiceModal);
        const invoice = invoices.find(inv => inv.id === currentInvoiceDocId);
        if (invoice) {
            invoiceModalTitle.textContent = 'ערוך חשבונית';
            populateInvoiceForm(invoice);
            showModal(invoiceModal);
        }
    });
    deleteInvoiceBtn.addEventListener('click', () => {
        const invoice = invoices.find(inv => inv.id === currentInvoiceDocId);
        if (invoice) {
            showConfirmModal(
                'מחק חשבונית',
                `האם אתה בטוח שברצונך למחוק את חשבונית מספר ${invoice.invoiceId}? פעולה זו בלתי הפיכה ותמחק גם צ'קים הקשורים לחשבונית זו.`,
                () => deleteInvoice(invoice.id),
                'מחק',
                'button-danger'
            );
        }
    });

    // Pagination for invoices
    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderInvoicesTable();
        }
    });
    nextPageBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(invoices.length / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderInvoicesTable();
        }
    });

    // Sort for invoices table
    invoiceTableHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const sortBy = header.dataset.sortBy;
            if (invoiceSortColumn === sortBy) {
                invoiceSortDirection = invoiceSortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                invoiceSortColumn = sortBy;
                invoiceSortDirection = 'asc'; // Default to asc when changing column
            }
            renderInvoicesTable();
        });
    });


    // Clients Actions
    addClientBtnClientPage.addEventListener('click', () => {
        resetClientDetailsForm();
        clientDetailsModalTitle.textContent = 'הוסף לקוח חדש';
        showModal(clientDetailsModal);
    });

    clientDetailsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!validateClientDetailsForm()) {
            showToast('אנא מלא את כל השדות הנדרשים כראוי.', 'error');
            return;
        }

        const clientData = {
            name: clientDetailsNameInput.value.trim(),
            contactPerson: clientDetailsContactPersonInput.value.trim(),
            email: clientDetailsEmailInput.value.trim(),
            phone: clientDetailsPhoneInput.value.trim(),
        };

        await saveClient(clientData, clientDetailsDocIdInput.value || null);
    });

    cancelClientDetailsBtn.addEventListener('click', () => hideModal(clientDetailsModal));
    closeClientDetailsModalBtn.addEventListener('click', () => hideModal(clientDetailsModal));
    clientDetailsNameInput.addEventListener('input', validateClientDetailsForm);

    // Delegation for client table buttons
    clientTableBody.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        const clientId = target.dataset.id;
        const client = clients.find(c => c.id === clientId);
        if (!client) {
            showToast('לקוח לא נמצא.', 'error');
            return;
        }

        if (target.classList.contains('view-client-btn')) {
            currentClientDocId = client.id;
            clientDetailsModalTitle.textContent = `פרטי לקוח: ${client.name}`;
            populateClientDetailsForm(client);
            showModal(clientDetailsModal);
        } else if (target.classList.contains('delete-client-btn')) {
            showConfirmModal(
                'מחק לקוח',
                `האם אתה בטוח שברצונך למחוק את הלקוח "${client.name}"? פעולה זו בלתי הפיכה ותמחק את כל החשבוניות והצ'קים הקשורים אליו.`,
                () => deleteClient(client.id),
                'מחק הכל',
                'button-danger'
            );
        }
    });

    // Client details modal buttons (for invoices/checks within client modal)
    clientRelatedInvoicesTableBody.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;
        const invoiceId = target.dataset.id;
        const invoice = invoices.find(inv => inv.id === invoiceId);
        if (invoice && target.classList.contains('view-invoice-btn')) {
            hideModal(clientDetailsModal); // Hide client modal first
            currentInvoiceDocId = invoice.id;
            populateViewInvoiceModal(invoice);
            showModal(viewInvoiceModal);
        }
    });
    clientRelatedChecksTableBody.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;
        const checkId = target.dataset.id;
        const check = standaloneChecks.find(c => c.id === checkId);
        if (check && target.classList.contains('edit-check-btn')) {
            hideModal(clientDetailsModal); // Hide client modal first
            currentStandaloneCheckDocId = check.id;
            populateStandaloneCheckForm(check);
            showModal(addEditCheckModal);
        }
    });

    deleteClientBtn.addEventListener('click', () => {
        const client = clients.find(c => c.id === currentClientDocId);
        if (client) {
            showConfirmModal(
                'מחק לקוח',
                `האם אתה בטוח שברצונך למחוק את הלקוח "${client.name}"? פעולה זו בלתי הפיכה ותמחק את כל החשבוניות והצ'קים הקשורים אליו.`,
                () => deleteClient(client.id),
                'מחק הכל',
                'button-danger'
            );
        }
    });

    // Sort for clients table
    clientTableHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const sortBy = header.dataset.sortBy;
            if (clientSortColumn === sortBy) {
                clientSortDirection = clientSortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                clientSortColumn = sortBy;
                clientSortDirection = 'asc'; // Default to asc when changing column
            }
            renderClientsTable();
        });
    });

    // Checks Actions
    addStandaloneCheckBtn.addEventListener('click', () => {
        resetStandaloneCheckForm();
        showModal(addEditCheckModal);
    });
    cancelStandaloneCheckBtn.addEventListener('click', () => hideModal(addEditCheckModal));
    closeAddEditCheckModalBtn.addEventListener('click', () => hideModal(addEditCheckModal));

    standaloneCheckForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!validateStandaloneCheckForm()) {
            showToast('אנא מלא את כל השדות הנדרשים כראוי.', 'error');
            return;
        }

        const checkNumber = standaloneCheckNumberInput.value.trim();
        const clientId = standaloneCheckClientInput.dataset.clientId;
        const clientName = standaloneCheckClientInput.value.trim();
        const amount = parseFloat(standaloneCheckAmountInput.value);
        const date = standaloneCheckDateInput.value;
        const status = standaloneCheckStatusSelect.value;

        const checkData = {
            checkNumber,
            clientId,
            clientName,
            amount,
            date,
            status
        };

        await saveStandaloneCheck(checkData, standaloneCheckDocIdInput.value || null);
    });

    // Check form field change listeners for validation
    standaloneCheckNumberInput.addEventListener('input', validateStandaloneCheckForm);
    standaloneCheckAmountInput.addEventListener('input', validateStandaloneCheckForm);
    standaloneCheckDateInput.addEventListener('change', validateStandaloneCheckForm);
    standaloneCheckStatusSelect.addEventListener('change', validateStandaloneCheckForm);
    standaloneCheckClientInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        standaloneClientSuggestionsDiv.innerHTML = '';
        standaloneCheckClientInput.dataset.clientId = ''; // Clear client ID
        if (searchTerm.length > 0) {
            const filteredClients = clients.filter(c => c.name.toLowerCase().includes(searchTerm));
            filteredClients.forEach(client => {
                const suggestionDiv = document.createElement('div');
                suggestionDiv.textContent = client.name;
                suggestionDiv.dataset.clientId = client.id;
                suggestionDiv.addEventListener('click', () => {
                    standaloneCheckClientInput.value = client.name;
                    standaloneCheckClientInput.dataset.clientId = client.id;
                    standaloneClientSuggestionsDiv.innerHTML = '';
                    validateStandaloneCheckForm();
                });
                standaloneClientSuggestionsDiv.appendChild(suggestionDiv);
            });
        }
        validateStandaloneCheckForm();
    });
    standaloneCheckClientInput.addEventListener('blur', () => {
        setTimeout(() => {
            standaloneClientSuggestionsDiv.innerHTML = '';
        }, 200);
    });

    // Delegation for checks table buttons
    checksTableBody.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        const checkId = target.dataset.id;
        const check = standaloneChecks.find(c => c.id === checkId);
        if (!check) {
            showToast('צ'ק לא נמצא.', 'error');
            return;
        }

        if (target.classList.contains('edit-check-btn')) {
            currentStandaloneCheckDocId = check.id;
            populateStandaloneCheckForm(check);
            showModal(addEditCheckModal);
        } else if (target.classList.contains('delete-check-btn')) {
            showConfirmModal(
                'מחק צ'ק',
                `האם אתה בטוח שברצונך למחוק את צ'ק מספר ${check.checkNumber}? פעולה זו בלתי הפיכה.`,
                () => deleteStandaloneCheck(check.id),
                'מחק',
                'button-danger'
            );
        }
    });

    deleteStandaloneCheckBtn.addEventListener('click', () => {
        const check = standaloneChecks.find(c => c.id === currentStandaloneCheckDocId);
        if (check) {
            showConfirmModal(
                'מחק צ'ק',
                `האם אתה בטוח שברצונך למחוק את צ'ק מספר ${check.checkNumber}? פעולה זו בלתי הפיכה.`,
                () => deleteStandaloneCheck(check.id),
                'מחק',
                'button-danger'
            );
        }
    });

    // Sort for checks table
    checksTableHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const sortBy = header.dataset.sortBy;
            if (checkSortColumn === sortBy) {
                checkSortDirection = checkSortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                checkSortColumn = sortBy;
                checkSortDirection = 'asc'; // Default to asc when changing column
            }
            renderChecksTable();
        });
    });

    // Alerts page actions
    requestNotificationPermissionBtn.addEventListener('click', () => {
        if (!("Notification" in window)) {
            showToast("הדפדפן שלך לא תומך בהתראות שולחן עבודה.", 'error');
            return;
        }
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                showToast("הרשאת התראות ניתנה בהצלחה!", 'success');
            } else {
                showToast("הרשאת התראות נדחתה. לא תוכל לקבל התראות.", 'info');
            }
        });
    });

    // Confirm modal actions
    cancelConfirmBtn.addEventListener('click', () => {
        currentConfirmActionCallback = null; // Clear callback
        hideModal(confirmModal);
    });
    confirmActionBtn.addEventListener('click', () => {
        if (currentConfirmActionCallback) {
            currentConfirmActionCallback();
        }
        currentConfirmActionCallback = null; // Clear callback
        hideModal(confirmModal);
    });

    // Export CSV buttons
    exportCsvBtn.addEventListener('click', exportInvoicesToCsv);
    exportClientsCsvBtn.addEventListener('click', exportClientsToCsv);
    exportChecksCsvBtn.addEventListener('click', exportChecksToCsv);

    /**
     * Populates the view invoice modal with details.
     * @param {Object} invoice The invoice object to display.
     */
    function populateViewInvoiceModal(invoice) {
        const detailsDiv = document.getElementById('viewInvoiceDetails');
        if (!detailsDiv) return;

        const client = clients.find(c => c.id === invoice.clientId);
        const clientName = client ? client.name : 'לקוח לא ידוע';

        let checksHtml = 'אין צ\'קים קשורים.';
        if (invoice.checks && invoice.checks.length > 0) {
            checksHtml = '<h4 class="mt-4 mb-2 font-semibold">פרטי צ\'קים:</h4><ul>';
            invoice.checks.forEach(check => {
                checksHtml += `<li>מס' צ'ק: ${check.checkNumber || ''}, סכום: ${parseFloat(check.amount || 0).toLocaleString()} ₪, תאריך: ${displayDate(formatDate(check.date))}, סטטוס: ${check.status || ''}</li>`;
            });
            checksHtml += '</ul>';
        }

        detailsDiv.innerHTML = `
            <p><strong>מספר חשבונית:</strong> ${invoice.invoiceId}</p>
            <p><strong>לקוח:</strong> ${clientName}</p>
            <p><strong>סכום:</strong> ${parseFloat(invoice.amount || 0).toLocaleString()} ₪</p>
            <p><strong>תאריך חשבונית:</strong> ${displayDate(formatDate(invoice.invoiceDate))}</p>
            <p><strong>תנאי תשלום:</strong> ${invoice.terms}</p>
            <p><strong>תאריך יעד:</strong> ${displayDate(formatDate(invoice.dueDate))}</p>
            <p><strong>סטטוס:</strong> <span class="status-badge ${invoice.status === 'שולם' ? 'paid' : invoice.status === 'בפיגור' ? 'overdue' : 'pending'}">${invoice.status}</span></p>
            <p><strong>אופן תשלום:</strong> ${invoice.paymentMethod || ''}</p>
            ${checksHtml}
        `;
    }
});