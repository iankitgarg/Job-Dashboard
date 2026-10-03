/* global QUnit */
QUnit.config.autostart = false;

sap.ui.require(["com/auritas/jobdashboard/test/integration/AllJourneys"
], function () {
	QUnit.start();
});
