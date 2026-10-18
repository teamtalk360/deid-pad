// Hands the Entra ID auth response back to the DeID Pad window (MSAL Browser v5 redirect bridge).
msalRedirectBridge.broadcastResponseToMainFrame().catch(function(){document.body.textContent='Sign-in could not complete. Close this window and try again.';});
