sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (Controller, JSONModel, Filter, FilterOperator) {
    "use strict";

    return Controller.extend("com.auritas.jobdashboard.controller.main", {

      onInit: function () {

    const oModel = new sap.ui.model.json.JSONModel();

    const sPath = sap.ui.require.toUrl(
        "com/auritas/jobdashboard/model/data.json"
    );

    console.log("Loading JSON:", sPath);

    oModel.loadData(sPath);

    oModel.attachRequestCompleted(() => {

        let data = oModel.getData();

        console.log("Raw Data Loaded:", data);

        // ✅ FIX: handle DIRECT ARRAY
        const jobs = Array.isArray(data) ? data : [];

        const wrappedData = { jobs: jobs };

        this._enrichData(wrappedData);
        this._calculateKPIs(wrappedData);

        oModel.setData(wrappedData);
    });

    this.getView().setModel(oModel);
},
        // ================= ENRICH LOGIC =================
        _enrichData: function (data) {

            const jobs = data.jobs || [];

            const objectMap = {};

            jobs.forEach(job => {

                // dependency flag
                job.isBlockedByDependency =
                    job.status === "blocked" && job.depends_on?.length > 0;

                // grouping for conflict detection
                const obj = job.archiving_object;

                if (!objectMap[obj]) objectMap[obj] = [];
                objectMap[obj].push(job);
            });

            // detect schedule overlap conflicts
            Object.values(objectMap).forEach(group => {

                for (let i = 0; i < group.length; i++) {
                    for (let j = i + 1; j < group.length; j++) {

                        if (this._isOverlap(group[i], group[j])) {
                            group[i].conflict = true;
                            group[j].conflict = true;
                        }
                    }
                }
            });

            data.jobs = jobs;
        },

        // ================= KPI CALCULATION =================
        _calculateKPIs: function (data) {

            const jobs = data.jobs || [];

            let memorySaved = 0;
            let roi = 0;

            let failed = 0;
            let blocked = 0;
            let success = 0;

            jobs.forEach(j => {

                memorySaved += j.metrics?.db_space_reclaimed_gb || 0;
                roi += j.metrics?.est_monthly_storage_saving_usd || 0;

                switch (j.status) {
                    case "failed":
                        failed++;
                        break;
                    case "blocked":
                        blocked++;
                        break;
                    case "completed":
                        success++;
                        break;
                }
            });

            data.kpi = {
                totalJobs: jobs.length,
                memorySaved: Number(memorySaved.toFixed(1)),
                roi: Number(roi.toFixed(0)),
                failed,
                blocked,
                success
            };
        },

        // ================= OVERLAP CHECK =================
        _isOverlap: function (a, b) {

            const aStart = a.schedule?.window_start;
            const aEnd = a.schedule?.window_end;
            const bStart = b.schedule?.window_start;
            const bEnd = b.schedule?.window_end;

            if (!aStart || !aEnd || !bStart || !bEnd) return false;

            return (aStart <= bEnd && bStart <= aEnd);
        },

        // ================= STATUS FORMATTER =================
        formatStatus: function (status) {

            switch (status) {
                case "failed":
                    return "Error";
                case "blocked":
                    return "Warning";
                case "completed":
                    return "Success";
                case "running":
                    return "Information";
                default:
                    return "None";
            }
        },

        // ================= SEARCH FILTER =================
        onSearch: function (oEvent) {

            const query = oEvent.getParameter("newValue") || "";
            const filters = [];

            if (query) {
                filters.push(
                    new Filter("name", FilterOperator.Contains, query)
                );
            }

            this._applyFilters(filters);
        },

        // ================= STATUS FILTER =================
        onStatusFilter: function (oEvent) {

            const key = oEvent.getSource().getSelectedKey();
            const filters = [];

            if (key) {
                filters.push(
                    new Filter("status", FilterOperator.EQ, key)
                );
            }

            this._applyFilters(filters);
        },

        // ================= APPLY FILTERS =================
        _applyFilters: function (filters) {

            const oTable = this.byId("jobTable");
            const binding = oTable.getBinding("items");

            binding.filter(filters);
        }

    });
});