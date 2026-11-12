import React, { useEffect, useMemo, useState } from "react";
import apiClient from "../../services/api";

interface Props {
  subscriber: any;
}

interface PackageHistory {
  id: string;
  subscriberId: string;
  packageId?: string;

  packageName: string;

  downloadMbps: number;
  uploadMbps: number;

  price: number;
  validityDays: number;

  action: string;

  assignedAt: string;
  endedAt?: string;

  isCurrent: boolean;

  comment?: string;
}

const SubscriberPackageHistoryTab: React.FC<Props> = ({
  subscriber,
}) => {
  const [history, setHistory] = useState<
    PackageHistory[]
  >([]);

  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");

  const [filter, setFilter] = useState("ALL");

  const [selected, setSelected] =
    useState<PackageHistory | null>(null);

  const loadHistory = async () => {
    try {
      setLoading(true);

      const response = await apiClient.get(
        `/Subscribers/${subscriber.id}/package-history`,
      );

      setHistory(
        response.data?.data || [],
      );
    } catch (error) {
      console.error(
        "Package history error:",
        error,
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [subscriber.id]);

  const formatDate = (value?: string) => {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return date.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const formatPrice = (value: number) => {
    return `₹${Number(value || 0).toLocaleString(
      "en-IN",
      {
        minimumFractionDigits: 2,
      },
    )}`;
  };

  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      const matchesFilter =
        filter === "ALL" ||
        (filter === "CURRENT" &&
          item.isCurrent) ||
        (filter === "ENDED" &&
          !item.isCurrent);

      const text = `
        ${item.packageName}
        ${item.action}
        ${item.downloadMbps}
        ${item.uploadMbps}
      `.toLowerCase();

      const matchesSearch =
        !search ||
        text.includes(search.toLowerCase());

      return (
        matchesFilter &&
        matchesSearch
      );
    });
  }, [
    history,
    filter,
    search,
  ]);

  const currentPackage =
    history.find(
      (x) => x.isCurrent,
    );

  const totalPackages = history.length;

  const endedPackages =
    history.filter(
      (x) => !x.isCurrent,
    ).length;

  return (
    <div>

      {/* HEADER */}

      <div className="d-flex justify-content-between align-items-center mb-4">

        <div>
          <h5 className="fw-bold mb-1">
            Package History
          </h5>

          <div className="text-muted small">
            Subscriber package assignment,
            changes and validity history
          </div>
        </div>

        <button
          className="btn btn-light border rounded-pill px-3"
          onClick={loadHistory}
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" />
              Loading...
            </>
          ) : (
            <>🔄 Refresh</>
          )}
        </button>

      </div>

      {/* CURRENT PACKAGE */}

      {currentPackage && (
        <div className="card border-0 shadow-sm rounded-4 mb-4">

          <div className="card-body p-4">

            <div className="d-flex justify-content-between align-items-center">

              <div>

                <div className="text-muted small">
                  CURRENT PACKAGE
                </div>

                <h4 className="fw-bold mb-1">
                  {currentPackage.packageName}
                </h4>

                <div className="text-muted">
                  Active subscriber package
                </div>

              </div>

              <span className="badge bg-success rounded-pill px-3 py-2">
                🟢 CURRENT
              </span>

            </div>

            <div className="row g-3 mt-3">

              <PackageInfo
                title="Download"
                value={`${currentPackage.downloadMbps} Mbps`}
              />

              <PackageInfo
                title="Upload"
                value={`${currentPackage.uploadMbps} Mbps`}
              />

              <PackageInfo
                title="Price"
                value={formatPrice(
                  currentPackage.price,
                )}
              />

              <PackageInfo
                title="Validity"
                value={`${currentPackage.validityDays} Days`}
              />

            </div>

          </div>

        </div>
      )}

      {/* SUMMARY */}

      <div className="row g-3 mb-4">

        <Summary
          title="Package Records"
          value={totalPackages}
          icon="📦"
        />

        <Summary
          title="Current"
          value={
            currentPackage ? 1 : 0
          }
          icon="🟢"
          color="success"
        />

        <Summary
          title="Previous Packages"
          value={endedPackages}
          icon="🕘"
          color="secondary"
        />

        <Summary
          title="Subscriber"
          value={
            subscriber.fullName ||
            subscriber.pppoeUsername
          }
          icon="👤"
          color="primary"
        />

      </div>

      {/* FILTER */}

      <div className="card border-0 shadow-sm rounded-4 mb-4">

        <div className="card-body p-3">

          <div className="row g-2">

            <div className="col-lg-7">

              <div className="input-group">

                <span className="input-group-text bg-white">
                  🔎
                </span>

                <input
                  className="form-control"
                  placeholder="Search package..."
                  value={search}
                  onChange={(e) =>
                    setSearch(
                      e.target.value,
                    )
                  }
                />

              </div>

            </div>

            <div className="col-lg-5">

              <div className="btn-group w-100">

                <button
                  className={`btn ${
                    filter === "ALL"
                      ? "btn-primary"
                      : "btn-light border"
                  }`}
                  onClick={() =>
                    setFilter("ALL")
                  }
                >
                  All
                </button>

                <button
                  className={`btn ${
                    filter === "CURRENT"
                      ? "btn-success"
                      : "btn-light border"
                  }`}
                  onClick={() =>
                    setFilter(
                      "CURRENT",
                    )
                  }
                >
                  Current
                </button>

                <button
                  className={`btn ${
                    filter === "ENDED"
                      ? "btn-secondary"
                      : "btn-light border"
                  }`}
                  onClick={() =>
                    setFilter(
                      "ENDED",
                    )
                  }
                >
                  Previous
                </button>

              </div>

            </div>

          </div>

        </div>

      </div>

      {/* HISTORY */}

      <div className="card border-0 shadow-sm rounded-4">

        <div className="card-body p-0">

          <div className="p-4 border-bottom">

            <h6 className="fw-bold mb-1">
              Package Timeline
            </h6>

            <div className="text-muted small">
              Complete package assignment
              history
            </div>

          </div>

          {loading ? (
            <div className="text-center py-5">

              <div className="spinner-border text-primary" />

              <div className="text-muted mt-2">
                Loading package history...
              </div>

            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center py-5">

              <div style={{ fontSize: 42 }}>
                📦
              </div>

              <h6 className="fw-bold mt-3">
                No package history
              </h6>

              <div className="text-muted">
                No package assignment
                records found.
              </div>

            </div>
          ) : (
            filteredHistory.map(
              (item, index) => (
                <PackageHistoryRow
                  key={item.id}
                  item={item}
                  index={index}
                  formatDate={
                    formatDate
                  }
                  formatPrice={
                    formatPrice
                  }
                  onClick={() =>
                    setSelected(item)
                  }
                />
              ),
            )
          )}

        </div>

      </div>

      {/* DETAIL MODAL */}

      {selected && (
        <PackageDetailModal
          item={selected}
          onClose={() =>
            setSelected(null)
          }
          formatDate={formatDate}
          formatPrice={formatPrice}
        />
      )}

    </div>
  );
};

export default SubscriberPackageHistoryTab;

// ============================================================
// SUMMARY
// ============================================================

const Summary = ({
  title,
  value,
  icon,
  color = "dark",
}: {
  title: string;
  value: any;
  icon: string;
  color?: string;
}) => (
  <div className="col-xl-3 col-md-6">

    <div className="card border-0 shadow-sm rounded-4 h-100">

      <div className="card-body p-4">

        <div className="d-flex justify-content-between align-items-center">

          <div>

            <div className="text-muted small">
              {title}
            </div>

            <div
              className={`fw-bold text-${color}`}
              style={{
                fontSize: 22,
              }}
            >
              {value}
            </div>

          </div>

          <div
            className="rounded-circle bg-light d-flex align-items-center justify-content-center"
            style={{
              width: 45,
              height: 45,
              fontSize: 20,
            }}
          >
            {icon}
          </div>

        </div>

      </div>

    </div>

  </div>
);

// ============================================================
// PACKAGE INFO
// ============================================================

const PackageInfo = ({
  title,
  value,
}: {
  title: string;
  value: string;
}) => (
  <div className="col-md-3">

    <div className="bg-light rounded-3 p-3">

      <div className="text-muted small">
        {title}
      </div>

      <div className="fw-bold mt-1">
        {value}
      </div>

    </div>

  </div>
);

// ============================================================
// HISTORY ROW
// ============================================================

const PackageHistoryRow = ({
  item,
  index,
  formatDate,
  formatPrice,
  onClick,
}: {
  item: PackageHistory;
  index: number;
  formatDate: (
    value?: string,
  ) => string;
  formatPrice: (
    value: number,
  ) => string;
  onClick: () => void;
}) => {
  const current = item.isCurrent;

  return (
    <div
      className="p-4 border-bottom"
      style={{
        cursor: "pointer",
      }}
      onClick={onClick}
    >

      <div className="row align-items-center g-3">

        <div className="col-auto">

          <div
            className={`rounded-circle d-flex align-items-center justify-content-center ${
              current
                ? "bg-success"
                : "bg-secondary"
            }`}
            style={{
              width: 42,
              height: 42,
              color: "white",
            }}
          >
            📦
          </div>

        </div>

        <div className="col-lg-3">

          <div className="fw-bold">
            {item.packageName}
          </div>

          <div className="text-muted small">
            {item.action}
          </div>

        </div>

        <div className="col-lg-2">

          <div className="text-muted small">
            Speed
          </div>

          <div className="small fw-semibold">
            ↓ {item.downloadMbps} Mbps
          </div>

          <div className="small fw-semibold">
            ↑ {item.uploadMbps} Mbps
          </div>

        </div>

        <div className="col-lg-2">

          <div className="text-muted small">
            Price
          </div>

          <div className="fw-semibold">
            {formatPrice(
              item.price,
            )}
          </div>

        </div>

        <div className="col-lg-2">

          <div className="text-muted small">
            Assigned
          </div>

          <div className="small fw-semibold">
            {formatDate(
              item.assignedAt,
            )}
          </div>

        </div>

        <div className="col-lg-2">

          {current ? (
            <span className="badge bg-success rounded-pill px-3 py-2">
              🟢 CURRENT
            </span>
          ) : (
            <>
              <div className="text-muted small">
                Ended
              </div>

              <div className="small fw-semibold">
                {formatDate(
                  item.endedAt,
                )}
              </div>
            </>
          )}

        </div>

      </div>

    </div>
  );
};

// ============================================================
// DETAIL MODAL
// ============================================================

const PackageDetailModal = ({
  item,
  onClose,
  formatDate,
  formatPrice,
}: {
  item: PackageHistory;
  onClose: () => void;
  formatDate: (
    value?: string,
  ) => string;
  formatPrice: (
    value: number,
  ) => string;
}) => (
  <div
    className="modal show d-block"
    style={{
      background:
        "rgba(15,23,42,.55)",
      backdropFilter: "blur(4px)",
    }}
  >

    <div className="modal-dialog modal-lg modal-dialog-centered">

      <div className="modal-content border-0 rounded-4 shadow-lg">

        <div className="modal-header bg-dark text-white border-0">

          <div>

            <div className="small opacity-75">
              PACKAGE DETAILS
            </div>

            <h5 className="mb-0 fw-bold">
              {item.packageName}
            </h5>

          </div>

          <button
            className="btn-close btn-close-white"
            onClick={onClose}
          />

        </div>

        <div className="modal-body p-4">

          <div className="d-flex justify-content-between mb-4">

            <div>

              <div className="text-muted small">
                STATUS
              </div>

              <h5
                className={
                  item.isCurrent
                    ? "text-success"
                    : "text-secondary"
                }
              >
                {item.isCurrent
                  ? "● CURRENT PACKAGE"
                  : "● ENDED"}
              </h5>

            </div>

            <span className="badge bg-light text-dark rounded-pill px-3 py-2">
              {item.action}
            </span>

          </div>

          <div className="row g-3">

            <PackageDetail
              title="Package"
              value={
                item.packageName
              }
            />

            <PackageDetail
              title="Download Speed"
              value={`${item.downloadMbps} Mbps`}
            />

            <PackageDetail
              title="Upload Speed"
              value={`${item.uploadMbps} Mbps`}
            />

            <PackageDetail
              title="Price"
              value={formatPrice(
                item.price,
              )}
            />

            <PackageDetail
              title="Validity"
              value={`${item.validityDays} Days`}
            />

            <PackageDetail
              title="Assigned At"
              value={formatDate(
                item.assignedAt,
              )}
            />

            <PackageDetail
              title="Ended At"
              value={formatDate(
                item.endedAt,
              )}
            />

            <PackageDetail
              title="Action"
              value={
                item.action
              }
            />

            <PackageDetail
              title="Comment"
              value={
                item.comment ||
                "-"
              }
            />

          </div>

        </div>

        <div className="modal-footer border-0">

          <button
            className="btn btn-dark rounded-pill px-4"
            onClick={onClose}
          >
            Close
          </button>

        </div>

      </div>

    </div>

  </div>
);

// ============================================================
// DETAIL BOX
// ============================================================

const PackageDetail = ({
  title,
  value,
}: {
  title: string;
  value: any;
}) => (
  <div className="col-md-6">

    <div className="bg-light border rounded-3 p-3">

      <div className="text-muted small">
        {title}
      </div>

      <div className="fw-semibold mt-1">
        {value || "-"}
      </div>

    </div>

  </div>
);