import { useSession, signIn, signOut } from "next-auth/react";
import { useState } from "react";
import { api } from "@/utils/api";
import { NextPage } from "next";
import Head from "next/head";
import Image from "next/image";

const Home: NextPage = () => {
  const { data: sessionData, status } = useSession();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

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
      } else {
        setError("Incorrect Email Address");
      }
    } catch (error) {
      setError("An unexpected error occurred.");
    }
  };

  const hello = api.hello.useQuery();

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
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-[623px] w-[1050px]">
          {/* Top Bar */}
          <div className="relative flex h-[48px] w-full items-center border-2 border-[#B6C6C6] bg-white pl-[15px] shadow-md">
            <div className="flex-1 text-center">
              <div className="inline-flex items-center gap-x-[4px] align-middle">
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
            </div>
            <div className="pr-[15px]">
              <Image
                src="/sign-in-images/cross.png"
                alt="Close"
                width={20}
                height={20}
              />
            </div>
          </div>

          {/* Keep existing content */}
          <div className="flex h-[575px] w-full flex-col items-center justify-center">
            <p>Signed in as {sessionData.user?.email}</p>
            <p>{hello.data ? hello.data.greeting : "Loading tRPC query..."}</p>
            <button
              onClick={() => signOut()}
              className="mt-4 rounded bg-red-500 px-4 py-2 text-white"
            >
              Sign out
            </button>
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
        <div className="flex h-[623px] w-[1050px] flex-col bg-white shadow-lg">
          {/* Top Bar */}
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
              />
            </div>
          </div>

          {/* Login Bar */}
          <div className="flex h-[50px] w-[990px] flex-col items-start justify-center gap-6 border-l-[2px] border-r-[2px] border-[#B6C6C6] bg-[#F0F1F1] py-[12px] pl-[24px] pr-[32px]">
            <h2 className="font-mono text-[20px] font-medium leading-[24px] tracking-normal text-[#001E20]">
              LOG IN TO YOUR ACCOUNT
            </h2>
          </div>

          {/* Main Content Area */}
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
                      <p className="m-0 font-sans text-[16px] font-normal not-italic leading-[19.2px] tracking-[-0.08px] text-[#F50000]">
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
                    width={16}
                    height={16}
                    style={{ marginLeft: "8px" }}
                  />
                </div>
                <button
                  onClick={handleSignIn}
                  disabled={!email}
                  className="flex h-[48px] w-[182px] items-center justify-center gap-2.5 rounded-sm bg-[#EFF4F4] px-10 py-3 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>

            {/* Right Side */}
            <div className="relative flex w-[525px] items-center justify-center border-2 border-l-0 border-solid border-[#B6C6C6]">
              <Image
                src="/sign-in-images/mail-illustration.png"
                alt="Mail illustration"
                layout="fill"
                objectFit="cover"
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Home;
