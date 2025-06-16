import { useSession, signIn, signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import { NextPage } from "next";
import Head from "next/head";
import Image from "next/image";

const Home: NextPage = () => {
  const { data: sessionData, status } = useSession();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [selectedTime, setSelectedTime] = useState("1 D");

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
    return (
      <div className="flex h-screen bg-white">
        {/* Sidebar */}
        <div
          className="flex h-full flex-col items-center justify-between flex-shrink-0"
          style={{
            width: "420px",
            padding: "16px 16px 21px 16px",
            backgroundColor: "#2D3748", // charcoal
            gap: "15px",
          }}
        >
          <button
            className="flex items-center rounded-[4px] border border-[#ACC6C5] bg-white"
            style={{
              width: "386px",
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
            <span className="font-mono text-[20px] font-normal leading-[24px] text-[#00474B] text-center">
              ADD BTC ADDRESS
            </span>
          </button>
          <div className="flex flex-col items-center">
            <button
              onClick={() => signOut()}
              className="mt-4 rounded bg-red-500 px-4 py-2 text-white"
            >
              Sign out
            </button>
          </div>
        </div>
        {/* Main Content */}
        <div className="flex w-full flex-grow flex-col bg-gray-50">
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
              <div className="flex h-[50px] shrink-0 items-center justify-start gap-[15px] border-b border-[#CDD] bg-white px-[14px] py-[10px]">
                {["1 D", "1 WK", "1 MO", "1 YR"].map((time) => (
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
              <div className="flex w-full flex-grow flex-col items-center justify-center gap-[10px]">
                <p
                  className="text-center text-[20px] font-medium leading-[24px] text-[#001E20]"
                  style={{ fontFamily: "'DM Mono', monospace" }}
                >
                  Add a BTC address to see holdings
                </p>
              </div>
            </div>
            {/* Transactions Section */}
            <div className="flex h-[calc(50%-12px)] flex-col rounded-[4px] border border-[#CDD] bg-white">
              <div className="flex h-[50px] shrink-0 items-center gap-[15px] rounded-t-[4px] border-b border-[#CDD] bg-[#F0F1F1] px-[14px] py-[10px]">
                <h1
                  className="m-0 text-[20px] font-medium leading-[24px] text-[#001E20]"
                  style={{ fontFamily: "'DM Mono', monospace" }}
                >
                  TRANSACTIONS
                </h1>
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
                    className="flex h-[48px] w-[182px] items-center justify-center gap-2.5 rounded-[4px] bg-[#EFF4F4] px-10 py-3 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>

              {/* Right Side */}
              <div className="relative flex w-[525px] items-center justify-center border-solid border-[#B6C6C6] border-t-0 border-b-0 border-l-0 border-r-2">
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
