import React, { useEffect, useState } from "react";
import axios from "axios";

const WalletBalanceCard: React.FC = () => {

  const [balance, setBalance] =
    useState<number>(0);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {

    const loadWallet = async () => {

      try {

        const token =
          localStorage.getItem("token");

        const response =
          await axios.get(
            "https://api.bharatradius.com/api/Wallet/balance",
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        setBalance(
          Number(
            response.data.balance || 0
          )
        );

      } catch (error) {

        console.error(
          "Wallet balance error:",
          error
        );

      } finally {

        setLoading(false);

      }
    };

    loadWallet();

  }, []);


  return (
    <div className="card border-0 shadow-sm rounded-4 h-100">

      <div className="card-body p-4">

        <div className="d-flex justify-content-between align-items-center">

          <div>

            <div className="text-muted small mb-2">
              Available Wallet Balance
            </div>

            <h2 className="fw-bold mb-1">
              {loading
                ? "..."
                : `₹${balance.toFixed(2)}`}
            </h2>

            <div className="text-muted small">
              Available for subscriber recharge
            </div>

          </div>


          <div
            className="rounded-circle d-flex align-items-center justify-content-center"
            style={{
              width: 55,
              height: 55,
              background: "#f1f5f9",
              fontSize: 24
            }}
          >
            ₹
          </div>

        </div>

      </div>

    </div>
  );
};

export default WalletBalanceCard;