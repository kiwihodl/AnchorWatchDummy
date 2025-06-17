import { type NextPage } from "next";
import Head from "next/head";
import { signIn, useSession } from "next-auth/react";
import Image from "next/image";
import { useState, useEffect, useMemo } from "react";
import {
  LineChart,
  Line,
  Tooltip,
  ResponsiveContainer,
  TooltipProps,
  Area,
} from "recharts";

// Define types for the API responses
interface Vin {
  prevout: {
    scriptpubkey_address: string;
    value: number;
  };
}

interface Vout {
  scriptpubkey_address: string;
  value: number;
}

interface Transaction {
  txid: string;
  status: {
    confirmed: boolean;
    block_time: number;
  };
  vin: Vin[];
  vout: Vout[];
}

interface Utxo {
  value: number;
}

interface ChartDataPoint {
  date: string;
  balance: number;
  fullDate: string;
  usdBalance: string;
}

interface ProcessedTransaction {
  txid: string;
  type: "SEND" | "RECEIVE";
  date: Date | null;
  amount: number;
  balance: number;
  status: "Completed" | "Pending";
}

interface Balance {
  btc: number;
  usd: number;
}

const Home: NextPage = () => {
  const { data: sessionData, status } = useSession();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [selectedTime, setSelectedTime] = useState("1 MO");
  const [isAddAddressPopupOpen, setIsAddAddressPopupOpen] = useState(false);
  const [btcAddress, setBtcAddress] = useState("");
  const [currentBtcAddress, setCurrentBtcAddress] = useState<string | null>(
    null
  );
  const [balance, setBalance] = useState<Balance | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [transactions, setTransactions] = useState<ProcessedTransaction[]>([]);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof ProcessedTransaction;
    direction: "asc" | "desc";
  }>({ key: "date", direction: "desc" });
  const [transactionFilter, setTransactionFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(
        () => setResendCooldown(resendCooldown - 1),
        1000
      );
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email) {
      setError("Email address is required.");
      return;
    }

    try {
      const response = await fetch("/api/check-email-allowed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();

      if (data.isAllowed) {
        signIn("email", { email, redirect: false });
        setEmailSubmitted(true);
        setResendCooldown(30);
      } else {
        setError("Incorrect Email Address");
      }
    } catch (error) {
      setError("An unexpected error occurred.");
    }
  };

  const handleResend = () => {
    if (resendCooldown === 0) {
      signIn("email", { email, redirect: false });
      setResendCooldown(30);
    }
  };

  const handleAddressSubmit = async () => {
    setIsLoading(true);
    setApiError(null);
    setBalance(null);
    setChartData([]);
    setCurrentBtcAddress(null);
    setTransactions([]);

    try {
      // Fetch transactions, UTXOs, and BTC price
      const [txsRes, utxosRes, pricesRes] = await Promise.all([
        fetch(`https://mempool.space/api/address/${btcAddress}/txs`),
        fetch(`https://mempool.space/api/address/${btcAddress}/utxo`),
        fetch(`https://mempool.space/api/v1/prices`),
      ]);

      if (!txsRes.ok) {
        throw new Error(
          "Failed to fetch transaction data. Please check the address and try again."
        );
      }
      if (!utxosRes.ok) {
        throw new Error(
          "Failed to fetch UTXO data. The address may be invalid or have no unspent outputs."
        );
      }
      if (!pricesRes.ok) {
        throw new Error(
          "Failed to fetch pricing data. Please try again later."
        );
      }

      const txs: Transaction[] = await txsRes.json();
      const utxos: Utxo[] = await utxosRes.json();
      const prices = await pricesRes.json();
      const btcPriceUsd = prices.USD;

      // Calculate current balance
      const totalSats = utxos.reduce((sum, utxo) => sum + utxo.value, 0);
      const btcBalance = totalSats / 1_000_000_00;
      const usdBalance = btcBalance * btcPriceUsd;

      setBalance({
        btc: btcBalance,
        usd: usdBalance,
      });

      // Process transactions for chart data
      const dataPoints: ChartDataPoint[] = [];
      const confirmedTxsForChart = txs
        .filter((tx) => tx.status.confirmed)
        .sort((a, b) => a.status.block_time - b.status.block_time);

      let currentSatBalance = 0;
      confirmedTxsForChart.forEach((tx) => {
        const valueIn = tx.vin.reduce(
          (sum, vin) =>
            vin.prevout?.scriptpubkey_address === btcAddress
              ? sum + vin.prevout.value
              : sum,
          0
        );
        const valueOut = tx.vout.reduce(
          (sum, vout) =>
            vout.scriptpubkey_address === btcAddress ? sum + vout.value : sum,
          0
        );
        currentSatBalance += valueOut - valueIn;

        const date = new Date(tx.status.block_time * 1000);
        const pointBalanceBtc = currentSatBalance / 1_000_00_000;

        dataPoints.push({
          date: date.toLocaleDateString("en-US", {
            month: "short",
            day: "2-digit",
          }),
          balance: pointBalanceBtc,
          fullDate: date.toDateString().toUpperCase(),
          usdBalance: (pointBalanceBtc * btcPriceUsd).toLocaleString("en-US", {
            style: "currency",
            currency: "USD",
          }),
        });
      });

      // Process transactions for the transaction list
      const allTxsSorted = [...txs].sort(
        (a, b) =>
          (b.status.block_time ?? Number.MAX_SAFE_INTEGER) -
          (a.status.block_time ?? Number.MAX_SAFE_INTEGER)
      );
      const finalBalanceSats = utxos.reduce((sum, utxo) => sum + utxo.value, 0);
      let runningBalanceSats = finalBalanceSats;

      const processedTxs: ProcessedTransaction[] = allTxsSorted.map((tx) => {
        const valueIn = tx.vin.reduce(
          (sum, vin) =>
            vin.prevout?.scriptpubkey_address === btcAddress
              ? sum + vin.prevout.value
              : sum,
          0
        );
        const valueOut = tx.vout.reduce(
          (sum, vout) =>
            vout.scriptpubkey_address === btcAddress ? sum + vout.value : sum,
          0
        );
        const netAmount = valueOut - valueIn;

        let balanceAfterTx;
        if (tx.status.confirmed) {
          balanceAfterTx = runningBalanceSats;
          runningBalanceSats -= netAmount;
        } else {
          // For pending, show what the balance would be
          balanceAfterTx = finalBalanceSats + netAmount;
        }

        return {
          txid: tx.txid,
          type: netAmount > 0 ? "RECEIVE" : "SEND",
          date: tx.status.confirmed
            ? new Date(tx.status.block_time * 1000)
            : null,
          amount: netAmount / 1_000_00_000,
          balance: balanceAfterTx / 1_000_00_000,
          status: tx.status.confirmed ? "Completed" : "Pending",
        };
      });

      setTransactions(processedTxs);
      setChartData(dataPoints);
      setCurrentBtcAddress(btcAddress);
      setIsLoading(false);
      setIsAddAddressPopupOpen(false);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "An unknown error occurred.";
      setApiError(errorMessage);
      setIsLoading(false);
    }
  };

  const displayedTransactions = useMemo(() => {
    let filtered = transactions;
    if (transactionFilter !== "ALL") {
      filtered = transactions.filter((tx) => {
        if (transactionFilter === "SENT") return tx.type === "SEND";
        if (transactionFilter === "RECEIVED") return tx.type === "RECEIVE";
        return true;
      });
    }

    const sorted = [...filtered].sort((a, b) => {
      if (sortConfig.key === "date") {
        const valA = a.date;
        const valB = b.date;

        if (valA && !valB) return sortConfig.direction === "asc" ? -1 : 1;
        if (!valA && valB) return sortConfig.direction === "asc" ? 1 : -1;

        if (valA && valB) {
          const timeA = valA.getTime();
          const timeB = valB.getTime();
          if (timeA < timeB) return sortConfig.direction === "asc" ? -1 : 1;
          if (timeA > timeB) return sortConfig.direction === "asc" ? 1 : -1;
        }
      } else {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === "asc" ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === "asc" ? 1 : -1;
        }
      }
      return 0;
    });

    const itemsPerPage = 9;
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sorted.slice(startIndex, startIndex + itemsPerPage);
  }, [transactions, transactionFilter, sortConfig, currentPage]);

  const totalPages = Math.ceil(
    transactions.filter((tx) => {
      if (transactionFilter === "ALL") return true;
      if (transactionFilter === "SENT") return tx.type === "SEND";
      if (transactionFilter === "RECEIVED") return tx.type === "RECEIVE";
      return true;
    }).length / 9
  );

  const requestSort = (key: keyof ProcessedTransaction) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="h-[623px] w-[1050px] bg-white shadow-lg">
          {/* This empty container will be shown during the loading state to prevent hydration errors */}
        </div>
      </div>
    );
  }

  if (sessionData) {
    if (isAddAddressPopupOpen) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#F8F8F8]">
          <div className="flex h-[627px] w-[1050px] flex-col bg-white shadow-lg">
            {/* Top Bar */}
            <div className="box-border relative flex h-[48px] min-h-[48px] w-full items-center justify-between border-2 border-solid border-[#B6C6C6] bg-white pl-[15px] pr-[15px]">
              <div className="flex">
                <Image
                  src="/sign-in-images/Back-arrow.svg"
                  alt="Back"
                  width={20}
                  height={20}
                  onClick={() => setIsAddAddressPopupOpen(false)}
                  style={{ cursor: "pointer", display: "block" }}
                />
              </div>
              <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 transform items-center gap-x-[4px]">
                <Image
                  src="/sign-in-images/complete-step.png"
                  alt="Step 1 complete"
                  width={16}
                  height={16}
                />
                <div
                  style={{
                    height: "1px",
                    width: "24px",
                    backgroundColor: "#000F10",
                  }}
                ></div>
                <Image
                  src="/sign-in-images/empty-step.png"
                  alt="Step 2 incomplete"
                  width={16}
                  height={16}
                />
              </div>
              <div className="flex h-[44px] items-center">
                <Image
                  src="/sign-in-images/cross.png"
                  alt="Close"
                  width={20}
                  height={20}
                  onClick={() => setIsAddAddressPopupOpen(false)}
                  style={{ cursor: "pointer" }}
                />
              </div>
            </div>

            {/* Title Bar */}
            <div className="box-border flex h-[50px] w-full flex-col items-start justify-center gap-6 border-l-[2px] border-r-[2px] border-[#B6C6C6] bg-[#F0F1F1] py-[12px] pl-[24px] pr-[32px]">
              <h2
                className="font-mono text-[20px] font-medium leading-[24px] tracking-normal text-[#001E20]"
                style={{ fontFamily: "'DM Mono'" }}
              >
                ADD BTC ADDRESS
              </h2>
            </div>

            {/* Main Content */}
            <div className="flex flex-grow flex-row">
              {/* Left Side */}
              <div className="box-border flex h-[525px] w-[525px] flex-col items-start justify-start border-l-2 border-y-2 border-r-0 border-solid border-[#B6C6C6] bg-white p-[24px] pb-[26px]">
                <p
                  className="font-sans text-[20px] font-medium not-italic leading-[24px] tracking-[-0.1px] text-[#001E20]"
                  style={{ fontFamily: "'DM Sans'" }}
                >
                  Enter the address below to add to your vault
                </p>
                <div className="mt-6 w-full">
                  <label
                    htmlFor="btcAddress"
                    className="font-sans text-[18px] font-medium leading-[21.6px] tracking-[-0.09px] text-[#001E20]"
                    style={{ fontFamily: "'DM Sans'" }}
                  >
                    ADDRESS
                  </label>
                  <input
                    id="btcAddress"
                    type="text"
                    value={btcAddress}
                    onChange={(e) => setBtcAddress(e.target.value)}
                    placeholder="Enter address here"
                    className="box-border mt-[4px] h-[50px] w-full self-stretch rounded-[4px] border-none bg-[#F0F1F1] px-[12px] font-sans text-[18px] leading-[21.6px] tracking-[-0.09px] text-[#001E20] focus:outline-none focus:ring-0"
                  />
                  <p className="mt-[4px] font-sans text-[16px] font-normal leading-[19.2px] tracking-[-0.08px] text-[#00474B]">
                    46 characters maximum
                  </p>
                  {apiError && <p className="mt-2 text-red-500">{apiError}</p>}
                </div>
                <div className="mt-auto flex w-full flex-col items-start gap-[16px]">
                  <div className="flex items-center gap-[10px]">
                    <span className="font-sans text-[14px] font-medium leading-[16.8px] text-[#001E20]">
                      Need help?
                    </span>
                    <Image
                      src="/sign-in-images/popout-help.svg"
                      alt="Help"
                      width={20}
                      height={20}
                    />
                  </div>
                  <button
                    onClick={handleAddressSubmit}
                    disabled={isLoading}
                    className={`flex h-[51px] w-[137px] items-center justify-center rounded-[4px] px-9 py-3 text-center font-mono text-[18px] font-normal not-italic leading-[21.6px] ${
                      isLoading
                        ? "cursor-not-allowed bg-gray-400 text-white"
                        : !btcAddress
                        ? "cursor-not-allowed bg-[#EFF4F4] text-gray-500"
                        : "bg-[#147C83] text-[#F8F8F8]"
                    }`}
                  >
                    {isLoading ? "Verifying..." : "Next"}
                  </button>
                </div>
              </div>

              {/* Right Side */}
              <div className="relative box-border h-[525px] w-[525px] bg-white">
                <Image
                  src="/sign-in-images/Address_popup.png"
                  alt="Address Popup"
                  layout="fill"
                  objectFit="cover"
                  className="border-none"
                />
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex h-screen flex-col bg-white">
        {/* Top Bar */}
        <div className="flex h-[80px] items-center bg-[#F0F1F1]">
          <div className="flex h-[46px] items-center gap-[32px] px-[40px] my-[17px]">
            <div className="flex h-[32px] w-[32px] items-center justify-center shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]">
              <Image
                src="/sign-in-images/AnchorWatch-logo2.svg"
                alt="AnchorWatch Logo"
                width={32}
                height={32}
              />
            </div>
            <div className="flex h-[50px] items-center justify-center px-[40px] py-[12px]">
              <span
                style={{ fontFamily: "'DM Mono'" }}
                className="text-center text-[20px] font-[500] not-italic leading-[24px] text-[#001E20]"
              >
                DASHBOARD
              </span>
            </div>
          </div>
        </div>
        {/* Second Bar: Address and Balance */}
        <div
          className="box-border flex h-[79px] w-full items-center justify-between border-y border-[#CDD] bg-white"
          style={{ padding: "10px 16px 10px 20px" }}
        >
          {/* Bitcoin Address Display */}
          <div className="flex h-full items-center">
            {currentBtcAddress && (
              <h1
                className="m-0 font-mono text-[32px] font-medium leading-[115%] tracking-[1.6px] text-[#001E20]"
                style={{ fontFamily: "'DM Mono'" }}
              >
                {`${currentBtcAddress.substring(
                  0,
                  10
                )}...${currentBtcAddress.substring(
                  currentBtcAddress.length - 10
                )}`}
              </h1>
            )}
          </div>
          {/* Balance Display */}
          {balance && (
            <div className="flex items-center gap-[24px]">
              {/* BTC Balance */}
              <div className="flex items-center gap-[9px]">
                <Image
                  src="/sign-in-images/BitcoinLogo-tilted.svg"
                  alt="Bitcoin Logo"
                  width={24}
                  height={24}
                />
                <p
                  className="m-0 font-mono text-[28px] font-medium leading-[115%] tracking-[1.4px] text-[#001E20]"
                  style={{ fontFamily: "'DM Mono'" }}
                >
                  {balance.btc.toFixed(8)} BTC
                </p>
              </div>
              {/* USD Balance */}
              <div className="m-0">
                <p
                  className="m-0 font-mono text-[24px] font-normal leading-[28.8px] text-[#00474B]"
                  style={{ fontFamily: "'DM Mono'" }}
                >
                  {balance.usd.toLocaleString("en-US", {
                    style: "currency",
                    currency: "USD",
                  })}{" "}
                  USD
                </p>
              </div>
            </div>
          )}
        </div>
        {/* Third Bar: Quick Actions */}
        <div className="flex">
          {/* Left Section - Quick Actions */}
          <div className="box-border flex h-[50px] w-[419px] flex-col items-start justify-center border-b border-[#CDD] bg-[#F0F1F1] px-[20px] py-[13px]">
            <span
              style={{ fontFamily: "'DM Mono'" }}
              className="text-[20px] font-[500] leading-[24px] text-[#001E20]"
            >
              QUICK ACTIONS
            </span>
          </div>
          {/* Right Section */}
          <div
            className="box-border flex h-[50px] flex-1 items-center gap-[10px] border-b border-l border-[#CDD] bg-[#F0F1F1] px-[20px] py-[10px]"
            style={{ paddingRight: "16px" }}
          ></div>
        </div>
        <div className="flex flex-1">
          {/* Left Sidebar */}
          <div
            className="flex h-full w-[420px] flex-col border-r border-[#CDD] bg-[#F8F8F8] p-[16px] pt-0"
            style={{
              paddingBottom: "21px",
              paddingLeft: "16px",
              paddingRight: "16px",
            }}
          >
            {/* Add BTC Address Button */}
            <div className="w-full" style={{ paddingTop: "15px" }}>
              <button
                onClick={() => {
                  setIsAddAddressPopupOpen(true);
                  setBtcAddress("");
                }}
                className="flex items-center rounded-[4px] border border-[#ACC6C5] bg-white"
                style={{
                  width: "387px",
                  height: "60px",
                  padding: "11px 20px",
                  gap: "20px",
                }}
              >
                <Image
                  src="/sign-in-images/Bitcoin-logo.svg"
                  alt="Bitcoin Logo"
                  width={24}
                  height={24}
                />
                <span className="text-center font-mono text-[20px] font-normal leading-[24px] text-[#00474B]">
                  ADD BTC ADDRESS
                </span>
              </button>
            </div>
            <div>
              <Image
                src="/sign-in-images/Sidebar-vector-line.png"
                alt="Vector"
                width={387}
                height={1}
                className="my-[15px]"
                style={{ alignSelf: "stretch" }}
              />
            </div>
          </div>
          {/* Main Content */}
          <div className="flex w-full flex-grow flex-col bg-[#FFFFFF]">
            <div
              style={{ margin: "24px", gap: "24px" }}
              className="flex h-[calc(100%-48px)] w-[calc(100%-48px)] flex-col"
            >
              {/* Holdings Section */}
              <div className="flex h-[calc(50%-12px)] flex-col rounded-[4px] border border-[#CDD] bg-white">
                <div className="flex h-[50px] shrink-0 items-center gap-[15px] rounded-t-[4px] border-b border-[#CDD] bg-[#F0F1F1] px-[14px] py-[10px]">
                  <h1
                    className="m-0 text-[20px] font-medium leading-[24px] text-[#001E20]"
                    style={{ fontFamily: "'DM Mono', monospace" }}
                  >
                    HOLDINGS
                  </h1>
                </div>
                <div className="box-border flex h-[50px] shrink-0 items-center justify-start gap-[15px] border-b border-[#CDD] bg-white px-[14px] py-[10px]">
                  {["1 D", "1 WK", "1 MO", "3 MO", "1 YR"].map((time) => (
                    <button
                      key={time}
                      onClick={() => setSelectedTime(time)}
                      style={{ width: "74px", height: "33px" }}
                      className={`flex items-center justify-center rounded-[4px] border-none bg-transparent font-mono text-[14px] font-normal leading-[16.8px] ${
                        selectedTime === time
                          ? "text-[#001E20]"
                          : "text-[#0E656B]"
                      }`}
                    >
                      {time}
                    </button>
                  ))}
                </div>
                <div className="flex w-full flex-grow flex-col items-stretch justify-end">
                  {currentBtcAddress ? (
                    <div className="p-[24px]">
                      <HoldingsChart
                        key={selectedTime}
                        data={chartData}
                        timeRange={selectedTime}
                      />
                    </div>
                  ) : (
                    <div className="flex flex-grow items-center justify-center">
                      <p
                        className="text-center text-[20px] font-medium leading-[24px] text-[#001E20]"
                        style={{ fontFamily: "'DM Mono', monospace" }}
                      >
                        Add a BTC address to see holdings
                      </p>
                    </div>
                  )}
                </div>
              </div>
              {/* Transactions Section */}
              <div className="flex h-[calc(50%-12px)] flex-col rounded-[4px] border border-[#CDD] bg-white">
                <div className="box-border flex h-[50px] shrink-0 items-center gap-[15px] rounded-t-[4px] border-b border-[#CDD] bg-[#F0F1F1] px-[14px] py-[10px]">
                  <h1
                    className="m-0 text-[20px] font-medium leading-[24px] text-[#001E20]"
                    style={{ fontFamily: "'DM Mono', monospace" }}
                  >
                    TRANSACTIONS
                  </h1>
                </div>
                {/* Transaction Filter Bar */}
                <div
                  className="box-border flex h-[50px] items-center justify-between border-y border-[#CDD] bg-[#F8F8F8] px-[14px] py-[10px]"
                  style={{ paddingRight: "39px" }}
                >
                  {/* Filter Buttons */}
                  <div className="flex items-center gap-[15px]">
                    {["ALL", "SENT", "RECEIVED"].map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setTransactionFilter(filter)}
                        className={`border-none bg-transparent font-mono text-[14px] font-normal leading-[16.8px] ${
                          transactionFilter === filter
                            ? "text-[#001E20]"
                            : "text-[#0E656B]"
                        }`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                  {/* View All Button */}
                  <button className="flex h-[33px] items-center justify-center gap-[10px] rounded-[4px] border border-[#0E656B] px-[20px] font-mono text-[14px] font-normal leading-[16.8px] text-[#0E656B] bg-transparent">
                    VIEW ALL
                  </button>
                </div>
                {/* Transaction Headers Bar */}
                <div className="box-border flex h-[50px] items-center border-b border-[#CDD] bg-white">
                  <div className="box-border flex h-[50px] w-[184px] items-center px-[12px] py-[15px]">
                    <span
                      className="font-mono text-[18px] font-[500] leading-[21.6px] text-[#001E20]"
                      style={{ fontFamily: "'DM Mono'" }}
                    >
                      TYPE
                    </span>
                  </div>
                  <div
                    className="box-border flex h-[50px] w-[234px] cursor-pointer items-center px-[12px] py-[15px]"
                    onClick={() => requestSort("date")}
                  >
                    <span
                      className="font-mono text-[18px] font-[500] leading-[21.6px] text-[#001E20]"
                      style={{ fontFamily: "'DM Mono'" }}
                    >
                      DATE
                    </span>
                  </div>
                  <div className="box-border flex h-[50px] w-[300px] items-center px-[12px] py-[15px]">
                    <span
                      className="font-mono text-[18px] font-[500] leading-[21.6px] text-[#001E20]"
                      style={{ fontFamily: "'DM Mono'" }}
                    >
                      TX ID
                    </span>
                  </div>
                  <div
                    className="box-border flex h-[50px] w-[200px] cursor-pointer items-center px-[12px] py-[15px]"
                    onClick={() => requestSort("amount")}
                  >
                    <span
                      className="font-mono text-[18px] font-[500] leading-[21.6px] text-[#001E20]"
                      style={{ fontFamily: "'DM Mono'" }}
                    >
                      AMOUNT (BTC)
                    </span>
                  </div>
                  <div className="box-border flex h-[50px] w-[234px] items-center px-[12px] py-[15px]">
                    <span
                      className="font-mono text-[18px] font-[500] leading-[21.6px] text-[#001E20]"
                      style={{ fontFamily: "'DM Mono'" }}
                    >
                      BALANCE (BTC)
                    </span>
                  </div>
                  <div
                    className="box-border flex h-[50px] w-[200px] cursor-pointer items-center justify-between bg-[#F0F1F1] px-[12px] py-[15px] self-stretch"
                    onClick={() => requestSort("status")}
                  >
                    <span
                      className="font-mono text-[18px] font-[500] leading-[21.6px] text-[#001E20]"
                      style={{ fontFamily: "'DM Mono'" }}
                    >
                      STATUS
                    </span>
                    <Image
                      src="/sign-in-images/Transactions-status-toggle.svg"
                      alt="Status Toggle"
                      width={16}
                      height={16}
                    />
                  </div>
                </div>
                {/* Transactions List */}
                <div className="flex-1 overflow-y-auto">
                  {displayedTransactions.length > 0 ? (
                    displayedTransactions.map((tx) => (
                      <div
                        key={tx.txid}
                        className="flex items-center border-b border-[#CDD]"
                      >
                        <div className="box-border flex h-[50px] w-[184px] items-center px-[12px] py-[15px]">
                          <span className="font-mono text-[16px] font-normal not-italic leading-[19.2px] text-[#147C83]">
                            {tx.type}
                          </span>
                        </div>
                        <div className="box-border flex h-[50px] w-[234px] items-center px-[12px] py-[15px]">
                          <span className="font-mono text-[16px] font-normal not-italic leading-[19.2px] text-[#147C83]">
                            {tx.date
                              ? tx.date.toLocaleDateString("en-US", {
                                  month: "2-digit",
                                  day: "2-digit",
                                  year: "numeric",
                                })
                              : "Pending"}
                          </span>
                        </div>
                        <div className="box-border flex h-[50px] w-[300px] items-center overflow-hidden text-ellipsis whitespace-nowrap px-[12px] py-[15px]">
                          <span className="font-mono text-[16px] font-normal not-italic leading-[19.2px] text-[#147C83]">
                            {tx.txid.substring(0, 25)}...
                          </span>
                        </div>
                        <div className="box-border flex h-[50px] w-[200px] items-center px-[12px] py-[15px]">
                          <span className="font-mono text-[16px] font-normal not-italic leading-[19.2px] text-[#147C83]">
                            {tx.amount > 0 ? "+ " : "- "}
                            {Math.abs(tx.amount).toFixed(8)}
                          </span>
                        </div>
                        <div className="box-border flex h-[50px] w-[234px] items-center px-[12px] py-[15px]">
                          <span className="font-mono text-[16px] font-normal not-italic leading-[19.2px] text-[#147C83]">
                            {tx.balance.toFixed(8)}
                          </span>
                        </div>
                        <div className="box-border flex h-[50px] w-[200px] items-center px-[12px] py-[15px]">
                          <span
                            className={`font-mono text-[16px] font-normal not-italic leading-[19.2px] ${
                              tx.status === "Completed"
                                ? "text-[#13D83E]"
                                : "text-[#DD8500]"
                            }`}
                          >
                            {tx.status}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <p
                        style={{ fontFamily: "'DM Mono'" }}
                        className="text-center text-[20px] font-[500] not-italic leading-[24px] text-[#001E20]"
                      >
                        No transactions to show
                      </p>
                    </div>
                  )}
                </div>
                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex h-[60px] items-center justify-center border-t border-[#CDD]">
                    <div
                      className="flex h-[60px] w-[353px] items-center justify-center"
                      style={{ gap: "25px" }}
                    >
                      <button
                        onClick={() =>
                          setCurrentPage((p) => Math.max(p - 1, 1))
                        }
                        disabled={currentPage === 1}
                        className="disabled:opacity-50 bg-transparent border-none p-0"
                      >
                        <Image
                          src="/sign-in-images/Pagination-left.svg"
                          alt="Previous"
                          width={24}
                          height={24}
                        />
                      </button>
                      <div className="flex" style={{ gap: "25px" }}>
                        {[...Array(4)].map((_, idx) => {
                          const pageNum =
                            currentPage + idx - Math.min(currentPage - 1, 3);
                          if (pageNum > totalPages) return null;
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setCurrentPage(pageNum)}
                              className={`font-mono text-[18px] font-normal leading-[21.6px] bg-transparent border-none p-0 ${
                                currentPage === pageNum
                                  ? "text-[#001E20]"
                                  : "text-[#147C83]"
                              }`}
                              style={{ fontFamily: "'DM Mono'" }}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                      </div>
                      <button
                        onClick={() =>
                          setCurrentPage((p) => Math.min(p + 1, totalPages))
                        }
                        disabled={currentPage === totalPages}
                        className="disabled:opacity-50 bg-transparent border-none p-0"
                      >
                        <Image
                          src="/sign-in-images/Pagination-right.svg"
                          alt="Next"
                          width={24}
                          height={24}
                        />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>AnchorWatch</title>
      </Head>
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        {emailSubmitted ? (
          <div className="flex h-[623px] w-[1050px] flex-col bg-white shadow-lg">
            {/* Nested Div 1: Top Bar (Email Submitted View) */}
            <div className="relative flex h-[44px] min-h-[44px] w-[1016px] items-center justify-between border-2 border-solid border-[#B6C6C6] bg-white pl-[15px] pr-[15px]">
              <div className="flex">
                <Image
                  src="/sign-in-images/Back-arrow.svg"
                  alt="Back"
                  width={20}
                  height={20}
                  onClick={() => setEmailSubmitted(false)}
                  style={{ cursor: "pointer", display: "block", lineHeight: 0 }}
                />
              </div>
              <div className="h-[44px] flex items-center gap-x-[4px] align-middle">
                <Image
                  src="/sign-in-images/complete-step.png"
                  alt="Step 1 complete"
                  width={16}
                  height={16}
                />
                <div
                  style={{
                    height: "1px",
                    width: "24px",
                    backgroundColor: "#000F10",
                  }}
                ></div>
                <Image
                  src="/sign-in-images/complete-step2.svg"
                  alt="Step 2 complete"
                  width={16}
                  height={16}
                />
              </div>
              <div className="flex h-[44px] items-center">
                <Image
                  src="/sign-in-images/cross.png"
                  alt="Close"
                  width={20}
                  height={20}
                />
              </div>
            </div>

            {/* Nested Div 2: Login Bar */}
            <div className="flex h-[50px] w-[990px] flex-col items-start justify-center gap-6 border-l-[2px] border-r-[2px] border-[#B6C6C6] bg-[#F0F1F1] py-[12px] pl-[24px] pr-[32px]">
              <h2 className="font-mono text-[20px] font-medium leading-[24px] tracking-normal text-[#001E20]">
                LOG IN TO YOUR ACCOUNT
              </h2>
            </div>

            {/* Nested Div 3: Main Content Area (Email Submitted View) */}
            <div className="flex flex-grow flex-row">
              {/* Left Side */}
              <div className="flex h-[525px] w-[525px] flex-col items-start justify-start border-2 border-solid border-[#B6C6C6] bg-white pt-[24px] pr-[24px] pb-[26px] pl-[24px]">
                <p className="font-sans text-[20px] font-medium not-italic leading-[24px] tracking-[-0.1px] text-[#001E20]">
                  Check your inbox for a sign in link. which is valid for 10
                  minutes, if you don&apos;t receive it in 30 seconds press
                  resend to receive another link.
                </p>
                <div className="mt-6 flex items-center gap-[10px]">
                  <button
                    onClick={handleResend}
                    disabled={resendCooldown > 0}
                    className={`flex h-[51px] w-[137px] items-center justify-center rounded-[4px] px-9 py-3 text-center font-mono text-[18px] font-normal not-italic leading-[21.6px] ${
                      resendCooldown > 0
                        ? "cursor-not-allowed bg-[#EFF4F4] text-gray-500"
                        : "bg-[#147C83] text-[#F8F8F8]"
                    }`}
                  >
                    Resend
                  </button>
                  {resendCooldown > 0 && (
                    <div className="flex items-center gap-[10px]">
                      <Image
                        src="/sign-in-images/Clock-resend.svg"
                        alt="cooldown"
                        width={16}
                        height={16}
                      />
                      <span className="font-sans text-[16px] font-normal not-italic leading-[19.2px] tracking-[-0.08px] text-[#00474B]">
                        {resendCooldown} seconds
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Side */}
              <div className="relative flex w-[525px] items-center justify-center border-solid border-[#B6C6C6] border-t-0 border-b-0 border-l-0 border-r-2">
                <Image
                  src="/sign-in-images/mail-illustration2.svg"
                  alt="Mail illustration"
                  layout="fill"
                  objectFit="cover"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-[623px] w-[1050px] flex-col bg-white shadow-lg">
            {/* Nested Div 1: Top Bar */}
            <div className="relative flex h-[44px] min-h-[44px] w-[1016px] items-center justify-between border-2 border-solid border-[#B6C6C6] bg-white pl-[15px] pr-[15px]">
              <div className="h-[44px] flex items-center pl-6"></div>
              <div className="h-[44px] flex items-center gap-x-[4px] align-middle">
                <Image
                  src="/sign-in-images/complete-step.png"
                  alt="Step 1 complete"
                  width={16}
                  height={16}
                />
                <div
                  style={{
                    height: "1px",
                    width: "24px",
                    backgroundColor: "#000F10",
                  }}
                ></div>
                <Image
                  src="/sign-in-images/empty-step.png"
                  alt="Step 2"
                  width={16}
                  height={16}
                />
              </div>
              <div className="h-[44px] flex items-center">
                <Image
                  src="/sign-in-images/cross.png"
                  alt="Close"
                  width={20}
                  height={20}
                  style={{ marginLeft: "8px" }}
                />
              </div>
            </div>

            {/* Nested Div 2: Login Bar */}
            <div className="flex h-[50px] w-[990px] flex-col items-start justify-center gap-6 border-l-[2px] border-r-[2px] border-[#B6C6C6] bg-[#F0F1F1] py-[12px] pl-[24px] pr-[32px]">
              <h2 className="font-mono text-[20px] font-medium leading-[24px] tracking-normal text-[#001E20]">
                LOG IN TO YOUR ACCOUNT
              </h2>
            </div>

            {/* Nested Div 3: Main Content Area */}
            <div className="flex flex-grow flex-row">
              {/* Left Side */}
              <div className="flex h-[525px] w-[525px] flex-col justify-between border-2 border-solid border-[#B6C6C6] bg-white pt-[24px] pr-[24px] pb-[26px] pl-[24px]">
                <div className="flex flex-col items-start gap-[24px]">
                  <h1 className="font-sans text-[20px] font-style-normal font-medium leading-[24px] tracking-[-0.1px] text-[#001E20]">
                    Enter your Anchorwatch registered email
                  </h1>
                  <form onSubmit={handleSignIn} className="flex flex-col gap-3">
                    <label className="font-mono text-[18px] font-normal leading-[21.6px] text-[#001E20]">
                      EMAIL
                    </label>
                    <div className="flex flex-col gap-1">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email"
                        className={`h-[50px] w-[477px] rounded-sm border bg-[#F0F1F1] pl-[10px] pr-4 focus:outline-none focus:ring-0 ${
                          error === "Incorrect Email Address"
                            ? "border-[#F50000] text-[#F50000]"
                            : "border-[#F0F1F1] text-[#001E20]"
                        }`}
                      />
                      {error && (
                        <p
                          style={{ marginTop: "4px" }}
                          className="font-sans text-[16px] font-normal not-italic leading-[19.2px] tracking-[-0.08px] text-[#F50000]"
                        >
                          {error}
                        </p>
                      )}
                    </div>
                    <button
                      type="submit"
                      className="hidden"
                      aria-hidden="true"
                    ></button>
                  </form>
                </div>
                <div className="flex flex-col items-start gap-[12px] self-stretch">
                  <div className="flex items-center">
                    <span className="font-mono text-[14px] font-normal not-italic leading-[16.8px] text-[#00474B]">
                      Need Help?
                    </span>
                    <Image
                      src="/sign-in-images/popout-help.svg"
                      alt="Help"
                      width={13}
                      height={13}
                      style={{ marginLeft: "8px" }}
                    />
                  </div>
                  <button
                    onClick={handleSignIn}
                    disabled={!email}
                    className={`flex h-[48px] w-[182px] items-center justify-center gap-2.5 rounded-[4px] px-10 py-3 font-mono text-[16px] font-normal leading-[19.2px] disabled:cursor-not-allowed ${
                      email
                        ? "bg-[#147C83] text-[#F8F8F8]"
                        : "bg-[#EFF4F4] text-black"
                    }`}
                  >
                    Next
                  </button>
                </div>
              </div>

              {/* Right Side */}
              <div className="relative flex w-[525px] items-center justify-center border-solid border-[#B6C6C6] border-2 border-l-0 border-r-2">
                <Image
                  src="/sign-in-images/mail-illustration.png"
                  alt="Mail illustration"
                  layout="fill"
                  objectFit="cover"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Home;

// Custom Tooltip for the Chart
const CustomTooltip = ({ active, payload }: TooltipProps<number, string>) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as ChartDataPoint;
    return (
      <div className="inline-flex flex-col items-start justify-center gap-[17px] border border-[#E2B000] bg-[#FFFCDE] p-[12px]">
        <div
          className="font-mono text-[14px] font-medium leading-[16.8px] text-[#8E6F00]"
          style={{ fontFamily: "'DM Mono'", letterSpacing: "0.1em" }}
        >
          {data.fullDate}
        </div>
        <div className="flex flex-col items-start">
          <div
            className="font-mono text-[14px] font-medium leading-[16.8px] text-[#B58E00]"
            style={{ fontFamily: "'DM Mono'" }}
          >
            Balance
          </div>
          <div
            className="font-mono text-[20px] font-medium leading-[24px] text-[#695200]"
            style={{ fontFamily: "'DM Mono'" }}
          >
            {data.balance.toFixed(8)} BTC
          </div>
          <div
            className="font-mono text-[14px] font-medium leading-[16.8px] text-[#8E6F00]"
            style={{ fontFamily: "'DM Mono'" }}
          >
            {data.usdBalance} USD
          </div>
        </div>
      </div>
    );
  }
  return null;
};

// Custom Dot for the Chart
interface CustomDotProps {
  cx?: number;
  cy?: number;
}

const CustomDot = ({ cx, cy }: CustomDotProps) => {
  if (cx === undefined || cy === undefined) return null;
  return (
    <g>
      <image
        href="/sign-in-images/Chart_ellipse.svg"
        x={cx - 8}
        y={cy - 8}
        width="16"
        height="16"
      />
    </g>
  );
};

// Chart Component
const HoldingsChart = ({
  data,
  timeRange,
}: {
  data: ChartDataPoint[];
  timeRange: string;
}) => {
  const getFilteredData = (
    data: ChartDataPoint[],
    timeRange: string
  ): ChartDataPoint[] => {
    const now = new Date();
    const startDate = new Date(now);

    switch (timeRange) {
      case "1 D":
        startDate.setDate(now.getDate() - 7);
        break;
      case "1 WK":
        startDate.setDate(now.getDate() - 28);
        break;
      case "1 MO":
        startDate.setMonth(now.getMonth() - 6);
        break;
      case "3 MO":
        startDate.setMonth(now.getMonth() - 18);
        break;
      case "1 YR":
        startDate.setFullYear(now.getFullYear() - 6);
        break;
      default:
        // Default to 6 months
        startDate.setMonth(now.getMonth() - 6);
        break;
    }
    return data.filter((d) => new Date(d.fullDate) >= startDate);
  };

  const getChartLabels = (timeRange: string): string[] => {
    const now = new Date();
    const labels: string[] = [];
    const numLabels = 4;

    const formatDate = (
      date: Date,
      options: Intl.DateTimeFormatOptions
    ): string => {
      return date.toLocaleDateString("en-US", options);
    };

    for (let i = 0; i < numLabels; i++) {
      const d = new Date(now);
      const denominator = numLabels - 1;

      switch (timeRange) {
        case "1 D": // 7 days range
          d.setDate(now.getDate() - ((denominator - i) * 7) / denominator);
          labels.push(formatDate(d, { month: "short", day: "numeric" }));
          break;
        case "1 WK": // 4 weeks range
          d.setDate(now.getDate() - ((denominator - i) * 28) / denominator);
          labels.push(formatDate(d, { month: "short", day: "numeric" }));
          break;
        case "1 MO": // 6 months range
          d.setMonth(now.getMonth() - ((denominator - i) * 6) / denominator);
          labels.push(formatDate(d, { month: "short", year: "2-digit" }));
          break;
        case "3 MO": // 18 months range
          d.setMonth(now.getMonth() - ((denominator - i) * 18) / denominator);
          labels.push(formatDate(d, { month: "short", year: "2-digit" }));
          break;
        case "1 YR": // 6 years range
          d.setFullYear(
            now.getFullYear() - ((denominator - i) * 6) / denominator
          );
          labels.push(formatDate(d, { year: "numeric" }));
          break;
        default:
          break;
      }
    }
    return labels;
  };

  const filteredData = getFilteredData(data, timeRange);
  const chartLabels = getChartLabels(timeRange);

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={278}>
        <LineChart
          data={filteredData}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <defs>
            <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="7.19%" stopColor="#86D3D9" stopOpacity={0.8} />
              <stop offset="79.68%" stopColor="#86D3D9" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="balance"
            stroke="none"
            fill="url(#balanceGradient)"
          />
          <Line
            type="monotone"
            dataKey="balance"
            stroke="#147C83"
            strokeWidth={2}
            dot={<CustomDot />}
            activeDot={{ r: 8 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-[18px] flex w-full justify-between">
        {chartLabels.map((label) => (
          <div
            key={label}
            className="font-mono text-[16px] font-medium leading-[19.2px] text-[#002C2F]"
            style={{ fontFamily: "'DM Mono'" }}
          >
            {label}
          </div>
        ))}
      </div>
    </div>
  );
};
