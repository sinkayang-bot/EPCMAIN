# EPCMAIN V3
New EPC Management branch using incremental Google Sheet synchronization.

Core rule: full bootstrap only on first load/manual refresh. Normal multi-device sync uses EPC_CHANGE_LOG cursor deltas and per-record revision checks to reject stale writes.

Deploy apps-script/EPCMainAPI.gs as an Apps Script Web App, run action=setup once, then set the /exec URL as epcApiUrl.