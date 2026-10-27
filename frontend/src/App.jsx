import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import "./App.css";

const API_URL = "http://127.0.0.1:8000";
const FULL_INTERVIEW_ROUNDS = ["Aptitude", "Technical", "Coding", "HR"];

function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const currentPage = {
    "/": "home",
    "/login": "login",
    "/register": "register",
    "/dashboard": "dashboard",
    "/interview": "interview",
    "/results": "results",
  }[location.pathname] || "home";

  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [resume, setResume] = useState(null);
  const [resumeMessage, setResumeMessage] = useState("");
  const [resumeLoading, setResumeLoading] = useState(false);

  const [practiceMode, setPracticeMode] = useState("individual");
  const [interviewType, setInterviewType] = useState("Technical");
  const [difficulty, setDifficulty] = useState("Easy");
  const [questionCount, setQuestionCount] = useState(5);

  const [sessionId, setSessionId] = useState(null);
  const [question, setQuestion] = useState(null);
  const [answer, setAnswer] = useState("");
  const [questionNumber, setQuestionNumber] = useState(0);
  const [interviewLoading, setInterviewLoading] = useState(false);
  const [interviewMessage, setInterviewMessage] = useState("");
  const [evaluation, setEvaluation] = useState(null);
  const [report, setReport] = useState(null);

  const [fullRoundIndex, setFullRoundIndex] = useState(0);
  const [roundReports, setRoundReports] = useState([]);
  const [fullInterviewComplete, setFullInterviewComplete] =
    useState(false);

  const [interviewHistory, setInterviewHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceRecognition, setVoiceRecognition] = useState(null);

  const questionText =
    typeof question === "string"
      ? question
      : question?.question ||
        question?.question_text ||
        question?.text ||
        "";

  const questionId = question?.question_id ?? question?.id ?? null;

  const currentRound =
    practiceMode === "full"
      ? FULL_INTERVIEW_ROUNDS[fullRoundIndex]
      : interviewType;

  const isLastQuestion =
    questionNumber >=
    (practiceMode === "full" ? 5 : questionCount);

  const completedInterviewCount = interviewHistory.filter(
    (item) => item.status === "completed"
  ).length;

  const inProgressInterviewCount = interviewHistory.filter(
    (item) => item.status !== "completed"
  ).length;

  const completedScores = interviewHistory
    .filter(
      (item) =>
        item.status === "completed" &&
        item.report &&
        Number.isFinite(Number(item.report.overall_score))
    )
    .map((item) => Number(item.report.overall_score));

  const averageScore =
    completedScores.length > 0
      ? (
          completedScores.reduce((sum, score) => sum + score, 0) /
          completedScores.length
        ).toFixed(2)
      : null;

  const getAuthHeaders = () => {
    const token =
      user?.access_token || localStorage.getItem("access_token");

    return token
      ? { Authorization: `Bearer ${token}` }
      : {};
  };

  const openLogin = () => {
    setAuthMode("login");
    navigate("/login");
    setAuthError("");
    setAuthSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openRegister = () => {
    setAuthMode("register");
    navigate("/register");
    setAuthError("");
    setAuthSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openHome = () => {
    navigate("/");
    setAuthError("");
    setAuthSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openDashboard = () => {
    if (!user) return openLogin();

    navigate("/dashboard");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openInterviewPage = () => {
    if (!user) return openLogin();

    navigate("/interview");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openResultsPage = () => {
    navigate("/results");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    if (user?.user_id && location.pathname === "/") {
      navigate("/dashboard", { replace: true });
    }
  }, [user?.user_id, location.pathname, navigate]);

  const handleAuthChange = (event) => {
    const { name, value } = event.target;

    setAuthForm((old) => ({
      ...old,
      [name]: value,
    }));

    setAuthError("");
    setAuthSuccess("");
  };

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setAuthError("");
    setAuthSuccess("");
    setAuthLoading(true);

    try {
      if (authMode === "register") {
        const response = await axios.post(`${API_URL}/users/`, {
          name: authForm.name.trim(),
          email: authForm.email.trim(),
          password: authForm.password,
        });

        setAuthSuccess(
          response.data?.message ||
            "Registration successful! You can now log in."
        );

        setAuthForm({
          name: "",
          email: authForm.email,
          password: "",
        });

        setAuthMode("login");
        navigate("/login");
      } else {
        const response = await axios.post(
          `${API_URL}/users/login`,
          {
            email: authForm.email.trim(),
            password: authForm.password,
          }
        );

        const userData = {
          user_id: response.data.user_id,
          name: response.data.name,
          email: response.data.email,
          access_token: response.data.access_token,
        };

        localStorage.setItem("user", JSON.stringify(userData));

        if (userData.access_token) {
          localStorage.setItem(
            "access_token",
            userData.access_token
          );
        }

        setUser(userData);
        navigate("/dashboard");

        setAuthForm({
          name: "",
          email: "",
          password: "",
        });

        setInterviewMessage("");
        setResumeMessage("");
        setHistoryError("");
      }
    } catch (error) {
      const detail =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        "Something went wrong. Please try again.";

      setAuthError(
        typeof detail === "string"
          ? detail
          : JSON.stringify(detail)
      );
    } finally {
      setAuthLoading(false);
    }
  };
  const stopSpeaking = () => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  const stopListening = () => {
    if (voiceRecognition) {
      try {
        voiceRecognition.stop();
      } catch {
        // Voice recognition may already have stopped.
      }
    }
    setIsListening(false);
  };

  const resetInterview = () => {
    stopSpeaking();
    stopListening();

    setSessionId(null);
    setQuestion(null);
    setAnswer("");
    setQuestionNumber(0);
    setEvaluation(null);
    setReport(null);
    setRoundReports([]);
    setFullRoundIndex(0);
    setFullInterviewComplete(false);
    setInterviewMessage("");

    navigate("/dashboard");
  };

  const handleLogout = () => {
    stopSpeaking();
    stopListening();

    localStorage.removeItem("user");
    localStorage.removeItem("access_token");

    setUser(null);
    setResume(null);
    setResumeMessage("");
    setInterviewMessage("");
    setInterviewHistory([]);
    setHistoryError("");
    setSessionId(null);
    setQuestion(null);
    setAnswer("");
    setEvaluation(null);
    setReport(null);
    setRoundReports([]);
    setFullRoundIndex(0);
    setFullInterviewComplete(false);

    navigate("/");
  };

  const fetchInterviewHistory = useCallback(async () => {
    if (!user?.user_id) {
      setInterviewHistory([]);
      setHistoryError("");
      return;
    }

    setHistoryLoading(true);
    setHistoryError("");

    try {
      const response = await axios.get(
        `${API_URL}/interview-session/history/${user.user_id}`,
        { headers: getAuthHeaders() }
      );

      setInterviewHistory(
        Array.isArray(response.data?.interviews)
          ? response.data.interviews
          : []
      );
    } catch (error) {
      const detail =
        error.response?.data?.detail ||
        "Could not load interview history.";

      setHistoryError(
        typeof detail === "string"
          ? detail
          : JSON.stringify(detail)
      );
    } finally {
      setHistoryLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user?.user_id) {
      fetchInterviewHistory();
    } else {
      setInterviewHistory([]);
    }
  }, [user?.user_id, fetchInterviewHistory]);

  const handleResumeUpload = async (event) => {
    event.preventDefault();

    if (!resume) {
      setResumeMessage("Please select a resume file first.");
      return;
    }

    if (!user?.user_id) {
      setResumeMessage("Please log in before uploading a resume.");
      return;
    }

    setResumeLoading(true);
    setResumeMessage("");

    try {
      const formData = new FormData();
      formData.append("file", resume);

      const response = await axios.post(
        `${API_URL}/resumes/upload`,
        formData,
        {
          headers: getAuthHeaders(),
          params: { user_id: user.user_id },
        }
      );

      setResumeMessage(
        response.data?.message || "Resume uploaded successfully!"
      );

      setResume(null);

      const input = document.getElementById("resumeFile");
      if (input) input.value = "";
    } catch (error) {
      const detail =
        error.response?.data?.detail ||
        "Resume upload failed. Please check your backend endpoint.";

      setResumeMessage(
        typeof detail === "string"
          ? detail
          : JSON.stringify(detail)
      );
    } finally {
      setResumeLoading(false);
    }
  };

  const createRoundSession = async (roundName) => {
    const roundQuestionCount =
      practiceMode === "full"
        ? 5
        : Math.max(5, Number(questionCount) || 5);

    const response = await axios.post(
      `${API_URL}/interview-session/start`,
      {
        user_id: user.user_id,
        interview_type: roundName,
        difficulty,
        question_count: roundQuestionCount,
      },
      { headers: getAuthHeaders() }
    );

    const newSessionId =
      response.data.session_id ?? response.data.id;

    if (!newSessionId) {
      throw new Error("The backend did not return a session ID.");
    }

    return newSessionId;
  };

  const getNextQuestion = async (
    activeSessionId = sessionId,
    roundName = currentRound
  ) => {
    if (!activeSessionId) {
      setInterviewMessage(
        "No interview session found. Please start again."
      );
      return false;
    }

    stopSpeaking();
    setInterviewLoading(true);
    setInterviewMessage("");
    setQuestion(null);
    setEvaluation(null);
    setAnswer("");

    try {
      const response = await axios.post(
        `${API_URL}/interview-session/${activeSessionId}/question`,
        {
          branch: "Information Technology",
          skills: "C, Java, Python, DBMS, DSA",
          interview_type: roundName,
        },
        { headers: getAuthHeaders() }
      );

      setQuestion(response.data);
      setQuestionNumber(
        Number(response.data.question_number) || 1
      );

      return true;
    } catch (error) {
      const detail =
        error.response?.data?.detail ||
        "Could not load the next question.";

      setInterviewMessage(
        typeof detail === "string"
          ? detail
          : JSON.stringify(detail)
      );

      return false;
    } finally {
      setInterviewLoading(false);
    }
  };

  const startInterview = async () => {
    if (!user?.user_id) {
      setInterviewMessage(
        "Please log in before starting an interview."
      );
      openLogin();
      return;
    }

    stopSpeaking();
    stopListening();

    setInterviewLoading(true);
    setInterviewMessage("");
    setQuestion(null);
    setAnswer("");
    setQuestionNumber(0);
    setEvaluation(null);
    setReport(null);
    setRoundReports([]);
    setFullRoundIndex(0);
    setFullInterviewComplete(false);
    setSessionId(null);

    // The interview opens on its own page.
    navigate("/interview");

    const firstRound =
      practiceMode === "full"
        ? FULL_INTERVIEW_ROUNDS[0]
        : interviewType;

    try {
      const newSessionId = await createRoundSession(firstRound);
      setSessionId(newSessionId);
      await getNextQuestion(newSessionId, firstRound);
    } catch (error) {
      const detail =
        error.response?.data?.detail ||
        error.message ||
        "Could not start the interview.";

      setInterviewMessage(
        typeof detail === "string"
          ? detail
          : JSON.stringify(detail)
      );
    } finally {
      setInterviewLoading(false);
    }
  };

  const speakQuestion = () => {
    if (!questionText) {
      setInterviewMessage("No question is available to read.");
      return;
    }

    if (!("speechSynthesis" in window)) {
      setInterviewMessage(
        "Voice output is not supported in this browser. Try Chrome."
      );
      return;
    }

    window.speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(questionText);
    speech.lang = "en-US";
    speech.rate = 0.9;
    speech.pitch = 1;

    speech.onstart = () => {
      setIsSpeaking(true);
      setInterviewMessage("AI interviewer is speaking...");
    };

    speech.onend = () => {
      setIsSpeaking(false);
      setInterviewMessage(
        "Question finished. Your turn to answer!"
      );
    };

    speech.onerror = () => {
      setIsSpeaking(false);
      setInterviewMessage("Could not play the question aloud.");
    };

    window.speechSynthesis.speak(speech);
  };

  const startVoiceInput = () => {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setInterviewMessage(
        "Voice input is not supported in this browser. Try Chrome."
      );
      return;
    }

    stopSpeaking();

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
      setInterviewMessage("Listening... Speak your answer.");
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;

      setAnswer((old) =>
        old ? `${old} ${transcript}` : transcript
      );

      setInterviewMessage("Voice answer captured.");
    };

    recognition.onerror = () => {
      setInterviewMessage(
        "Voice input failed. Please try again or type your answer."
      );
    };

    recognition.onend = () => setIsListening(false);
    setVoiceRecognition(recognition);

    try {
      recognition.start();
    } catch {
      setIsListening(false);
      setInterviewMessage(
        "Could not start voice input. Please try again."
      );
    }
  };

  const submitAnswer = async () => {
    if (!sessionId || !questionId || !answer.trim()) {
      setInterviewMessage(
        "Please make sure a question is loaded and your answer is entered."
      );
      return;
    }

    stopSpeaking();
    setInterviewLoading(true);
    setInterviewMessage("");

    try {
      const response = await axios.post(
        `${API_URL}/interview-session/${sessionId}/answer`,
        {
          answer: answer.trim(),
          question_id: questionId,
        },
        { headers: getAuthHeaders() }
      );

      setEvaluation(response.data);
      setInterviewMessage(
        "Answer saved successfully. Continue when you're ready."
      );
    } catch (error) {
      const detail =
        error.response?.data?.detail ||
        "Could not submit your answer.";

      setInterviewMessage(
        typeof detail === "string"
          ? detail
          : JSON.stringify(detail)
      );
    } finally {
      setInterviewLoading(false);
    }
  };
  const finishCurrentRound = async () => {
    if (!sessionId) {
      setInterviewMessage("No interview session was found.");
      return;
    }

    if (!evaluation) {
      setInterviewMessage(
        "Please submit your answer before finishing the round."
      );
      return;
    }

    setInterviewLoading(true);
    setInterviewMessage("");

    try {
      const response = await axios.post(
        `${API_URL}/interview-session/${sessionId}/report`,
        {},
        { headers: getAuthHeaders() }
      );

      const newRoundReport = {
        round: currentRound,
        session_id: sessionId,
        ...response.data,
      };

      if (practiceMode === "individual") {
        setReport(newRoundReport);
        setQuestion(null);
        setInterviewMessage("Interview report generated.");

        await fetchInterviewHistory();
        navigate("/results");
        return;
      }

      const updatedReports = [
        ...roundReports.filter(
          (item) => item.round !== currentRound
        ),
        newRoundReport,
      ];

      setRoundReports(updatedReports);

      const nextIndex = fullRoundIndex + 1;

      if (nextIndex >= FULL_INTERVIEW_ROUNDS.length) {
        const scores = updatedReports
          .map((item) => Number(item.overall_score))
          .filter(Number.isFinite);

        const combinedScore =
          scores.length > 0
            ? scores.reduce((sum, score) => sum + score, 0) /
              scores.length
            : 0;

        const combinedReport = {
          overall_score: Number(combinedScore.toFixed(2)),
          strengths: updatedReports
            .map(
              (item) =>
                `${item.round}: ${item.strengths || "Not provided"}`
            )
            .join("\n\n"),
          weaknesses: updatedReports
            .map(
              (item) =>
                `${item.round}: ${item.weaknesses || "Not provided"}`
            )
            .join("\n\n"),
          recommendations: updatedReports
            .map(
              (item) =>
                `${item.round}: ${
                  item.recommendations || "Not provided"
                }`
            )
            .join("\n\n"),
          round_reports: updatedReports,
        };

        setReport(combinedReport);
        setFullInterviewComplete(true);
        setQuestion(null);
        setInterviewMessage(
          "All four rounds are complete! Your combined report is ready."
        );

        await fetchInterviewHistory();
        navigate("/results");
        return;
      }

      const nextRound = FULL_INTERVIEW_ROUNDS[nextIndex];

      setFullRoundIndex(nextIndex);
      setInterviewType(nextRound);

      const newSessionId = await createRoundSession(nextRound);
      setSessionId(newSessionId);

      await getNextQuestion(newSessionId, nextRound);

      setInterviewMessage(
        `${currentRound} completed. Starting ${nextRound} round.`
      );

      await fetchInterviewHistory();
    } catch (error) {
      const detail =
        error.response?.data?.detail ||
        "Could not generate the report. Make sure every question has been answered.";

      setInterviewMessage(
        typeof detail === "string"
          ? detail
          : JSON.stringify(detail)
      );
    } finally {
      setInterviewLoading(false);
    }
  };

  const renderReport = (data) => {
    if (!data) return null;

    return (
      <div className="report-card">
        <h3>
          {data.round_reports?.length
            ? "Full Interview Report"
            : "Interview Report"}
        </h3>

        <div className="report-score">
          <span>Overall Score</span>
          <strong>
            {Number.isFinite(Number(data.overall_score))
              ? Number(data.overall_score).toFixed(2)
              : "N/A"}{" "}
            / 10
          </strong>
        </div>

        <h4>Strengths</h4>
        <p className="report-text">
          {data.strengths || "No strengths provided."}
        </p>

        <h4>Weaknesses</h4>
        <p className="report-text">
          {data.weaknesses || "No weaknesses provided."}
        </p>

        <h4>Recommendations</h4>
        <p className="report-text">
          {data.recommendations || "No recommendations provided."}
        </p>

        {data.round_reports?.length > 0 && (
          <>
            <h4>Round-wise Scores</h4>

            {data.round_reports.map((item) => (
              <div
                className="round-report-item"
                key={`${item.round}-${item.session_id}`}
              >
                <strong>{item.round}</strong>
                <p>
                  Score:{" "}
                  {Number.isFinite(Number(item.overall_score))
                    ? Number(item.overall_score).toFixed(2)
                    : "N/A"}{" "}
                  / 10
                </p>
              </div>
            ))}
          </>
        )}
      </div>
    );
  };
  const renderHomePage = () => (
    <main>
      <section className="hero">
        <div className="hero-content">
          <span className="eyebrow">
            AI-POWERED INTERVIEW PREPARATION
          </span>

          <h1>
            Your next interview.
            <br />
            <span>Your best performance.</span>
          </h1>

          <p>
            Practice interviews, improve your answers, and build
            confidence with your personal AI interview assistant.
          </p>

          <div className="hero-actions">
            <button className="primary-button" onClick={openRegister}>
              Get Started
            </button>

            <button className="secondary-button" onClick={openLogin}>
              Login
            </button>
          </div>

          <div className="hero-note">
            Practice at your own pace. Improve one answer at a time.
          </div>
        </div>

        <div className="hero-visual">
          <div className="visual-card">
            <div className="visual-icon">✦</div>
            <h3>Your interview journey</h3>

            <div className="visual-step">
              <span>01</span>
              <div>
                <strong>Prepare</strong>
                <p>Upload your resume</p>
              </div>
            </div>

            <div className="visual-step">
              <span>02</span>
              <div>
                <strong>Practice</strong>
                <p>Answer interview questions</p>
              </div>
            </div>

            <div className="visual-step">
              <span>03</span>
              <div>
                <strong>Improve</strong>
                <p>Review your feedback</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="features" id="features">
        <div className="section-heading">
          <span className="eyebrow">WHAT YOU CAN DO</span>
          <h2>Prepare smarter. Interview better.</h2>
          <p>
            Everything you need to practise and assess your interview
            readiness in one place.
          </p>
        </div>

        <div className="feature-grid">
          <article className="feature-card">
            <div className="feature-icon">📄</div>
            <h3>Resume Upload</h3>
            <p>
              Upload your resume and keep your preparation materials
              together.
            </p>
          </article>

          <article className="feature-card">
            <div className="feature-icon">💬</div>
            <h3>Mock Interviews</h3>
            <p>
              Practise aptitude, technical, coding, and HR questions.
            </p>
          </article>

          <article className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>AI Feedback</h3>
            <p>
              Review answer evaluations and identify areas to improve.
            </p>
          </article>
        </div>
      </section>

      <section className="cta-section">
        <h2>Ready to practise?</h2>
        <p>Start building your interview confidence today.</p>
        <button className="primary-button" onClick={openRegister}>
          Create Your Account
        </button>
      </section>
    </main>
  );

  const renderAuthPage = () => (
    <main className="auth-page">
      <div className="auth-card">
        <button className="back-button" onClick={openHome}>
          ← Back to Home
        </button>

        <div className="auth-brand">
          <div className="brand-symbol">AI</div>
          <span>Interview Assistant</span>
        </div>

        <div className="auth-heading">
          <span className="eyebrow">
            {authMode === "login" ? "WELCOME BACK" : "LET'S GET STARTED"}
          </span>

          <h1>
            {authMode === "login"
              ? "Welcome back!"
              : "Create your account"}
          </h1>

          <p>
            {authMode === "login"
              ? "Log in to continue your interview preparation."
              : "Register to start practising for your interviews."}
          </p>
        </div>

        {authError && (
          <div className="alert alert-error" role="alert">
            {authError}
          </div>
        )}

        {authSuccess && (
          <div className="alert alert-success" role="status">
            {authSuccess}
          </div>
        )}

        <form onSubmit={handleAuthSubmit} className="auth-form">
          {authMode === "register" && (
            <div className="form-group">
              <label htmlFor="name">Full name</label>
              <input
                id="name"
                type="text"
                name="name"
                placeholder="Enter your full name"
                value={authForm.name}
                onChange={handleAuthChange}
                autoComplete="name"
                required
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              name="email"
              placeholder="you@example.com"
              value={authForm.email}
              onChange={handleAuthChange}
              autoComplete="email"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              name="password"
              placeholder="Enter your password"
              value={authForm.password}
              onChange={handleAuthChange}
              autoComplete={
                authMode === "login"
                  ? "current-password"
                  : "new-password"
              }
              minLength={6}
              required
            />
          </div>

          <button
            type="submit"
            className="primary-button auth-submit"
            disabled={authLoading}
          >
            {authLoading
              ? "Please wait..."
              : authMode === "login"
              ? "Login"
              : "Create Account"}
          </button>
        </form>

        <div className="auth-switch">
          {authMode === "login" ? (
            <p>
              Don't have an account?{" "}
              <button type="button" onClick={openRegister}>
                Register
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{" "}
              <button type="button" onClick={openLogin}>
                Login
              </button>
            </p>
          )}
        </div>

        <p className="auth-footer">
          Your interview preparation starts here.
        </p>
      </div>
    </main>
  );
  const renderInterviewHistory = () => (
    <section className="history-section">
      <div className="section-heading">
        <span className="eyebrow">YOUR PROGRESS</span>
        <h2>Interview History</h2>
        <p>
          Review your previous interviews and saved AI-generated reports.
        </p>
      </div>

      {historyLoading && (
        <p className="status-message">
          Loading your interview history...
        </p>
      )}

      {historyError && (
        <div className="alert alert-error" role="alert">
          <p>{historyError}</p>
          <button
            className="secondary-button"
            onClick={fetchInterviewHistory}
            disabled={historyLoading}
          >
            Try Again
          </button>
        </div>
      )}

      {!historyLoading && !historyError && (
        <>
          <div className="history-summary">
            <article className="dashboard-card">
              <div className="card-icon">📋</div>
              <h3>Total Interviews</h3>
              <strong>{interviewHistory.length}</strong>
            </article>

            <article className="dashboard-card">
              <div className="card-icon">✅</div>
              <h3>Completed</h3>
              <strong>{completedInterviewCount}</strong>
            </article>

            <article className="dashboard-card">
              <div className="card-icon">⏳</div>
              <h3>In Progress</h3>
              <strong>{inProgressInterviewCount}</strong>
            </article>

            <article className="dashboard-card">
              <div className="card-icon">📈</div>
              <h3>Average Score</h3>
              <strong>
                {averageScore !== null ? `${averageScore}/10` : "—"}
              </strong>
            </article>
          </div>

          {interviewHistory.length === 0 ? (
            <div className="dashboard-card">
              <h3>No interviews yet</h3>
              <p>
                Start your first mock interview to see your results here.
              </p>
            </div>
          ) : (
            <div className="history-list">
              {interviewHistory.map((item) => (
                <article
                  className="dashboard-card history-item"
                  key={item.session_id}
                >
                  <div className="history-details">
                    <h3>{item.interview_type} Interview</h3>
                    <p><strong>Session:</strong> {item.session_id}</p>
                    <p><strong>Difficulty:</strong> {item.difficulty}</p>
                    <p><strong>Questions:</strong> {item.question_count}</p>
                    <p>
                      <strong>Started:</strong>{" "}
                      {item.started_at
                        ? new Date(item.started_at).toLocaleString()
                        : "Not available"}
                    </p>

                    {item.completed_at && (
                      <p>
                        <strong>Completed:</strong>{" "}
                        {new Date(item.completed_at).toLocaleString()}
                      </p>
                    )}
                  </div>

                  <div className="history-result">
                    <span
                      className={
                        item.status === "completed"
                          ? "history-status completed"
                          : "history-status in-progress"
                      }
                    >
                      {item.status === "completed"
                        ? "✓ Completed"
                        : "In Progress"}
                    </span>

                    {item.report ? (
                      <>
                        <strong className="history-score">
                          {Number.isFinite(Number(item.report.overall_score))
                            ? Number(item.report.overall_score).toFixed(2)
                            : "N/A"}
                          /10
                        </strong>

                        <details className="history-report-details">
                          <summary>View Saved Report</summary>
                          <h4>Strengths</h4>
                          <p className="report-text">
                            {item.report.strengths || "Not provided"}
                          </p>
                          <h4>Weaknesses</h4>
                          <p className="report-text">
                            {item.report.weaknesses || "Not provided"}
                          </p>
                          <h4>Recommendations</h4>
                          <p className="report-text">
                            {item.report.recommendations || "Not provided"}
                          </p>
                        </details>
                      </>
                    ) : (
                      <p className="history-no-report">
                        No final report is available for this session.
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}

          <button
            className="secondary-button"
            onClick={fetchInterviewHistory}
            disabled={historyLoading}
          >
            {historyLoading ? "Refreshing..." : "🔄 Refresh History"}
          </button>
        </>
      )}
    </section>
  );

  const renderDashboard = () => (
    <main className="dashboard">
      <section className="dashboard-welcome">
        <div>
          <span className="eyebrow">YOUR PERSONAL WORKSPACE</span>
          <h1>
            Welcome{user?.name ? `, ${user.name}` : ""}! 👋
          </h1>
          <p>
            Choose an interview mode, practise, and review your results.
          </p>
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="dashboard-card">
          <div className="card-icon">📄</div>
          <h2>Resume</h2>
          <p>
            Upload your resume to keep your preparation materials organised.
          </p>

          <form onSubmit={handleResumeUpload} className="resume-form">
            <label htmlFor="resumeFile">Choose resume file</label>
            <input
              id="resumeFile"
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(event) =>
                setResume(event.target.files?.[0] || null)
              }
            />

            {resume && (
              <p className="selected-file">
                Selected: {resume.name}
              </p>
            )}

            <button
              type="submit"
              className="primary-button"
              disabled={resumeLoading}
            >
              {resumeLoading ? "Uploading..." : "Upload Resume"}
            </button>
          </form>

          {resumeMessage && (
            <p className="status-message">{resumeMessage}</p>
          )}
        </article>

        <article className="dashboard-card">
          <div className="card-icon">🎯</div>
          <h2>Interview Practice</h2>
          <p>
            Choose individual practice or complete all four interview rounds.
          </p>

          <div className="form-group">
            <label htmlFor="practiceMode">Practice mode</label>
            <select
              id="practiceMode"
              value={practiceMode}
              onChange={(event) => setPracticeMode(event.target.value)}
              disabled={Boolean(sessionId)}
            >
              <option value="individual">Individual Round Practice</option>
              <option value="full">Full Interview Practice</option>
            </select>
          </div>

          {practiceMode === "individual" ? (
            <div className="form-group">
              <label htmlFor="interviewType">Interview round</label>
              <select
                id="interviewType"
                value={interviewType}
                onChange={(event) => setInterviewType(event.target.value)}
                disabled={Boolean(sessionId)}
              >
                <option value="Aptitude">Aptitude</option>
                <option value="Technical">Technical</option>
                <option value="Coding">Coding</option>
                <option value="HR">HR</option>
              </select>
            </div>
          ) : (
            <div className="round-sequence">
              <strong>Round sequence</strong>
              <p>Aptitude → Technical → Coding → HR</p>
              <p>Five questions are used in each round.</p>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="difficulty">Difficulty</label>
            <select
              id="difficulty"
              value={difficulty}
              onChange={(event) => setDifficulty(event.target.value)}
              disabled={Boolean(sessionId)}
            >
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>

          {practiceMode === "individual" && (
            <div className="form-group">
              <label htmlFor="questionCount">Number of questions</label>
              <select
                id="questionCount"
                value={questionCount}
                onChange={(event) =>
                  setQuestionCount(Number(event.target.value))
                }
                disabled={Boolean(sessionId)}
              >
                <option value={5}>5 Questions</option>
                <option value={10}>10 Questions</option>
                <option value={15}>15 Questions</option>
              </select>
            </div>
          )}

          <button
            className="primary-button"
            onClick={startInterview}
            disabled={interviewLoading || Boolean(sessionId)}
          >
            {interviewLoading ? "Please wait..." : "Start Interview"}
          </button>

          {sessionId && (
            <button
              className="secondary-button"
              onClick={resetInterview}
              disabled={interviewLoading}
            >
              End / Reset Practice
            </button>
          )}

          <p className="status-message">
            Your interview opens on a separate page.
          </p>
        </article>
      </section>

      {renderInterviewHistory()}
    </main>
  );
  const renderInterviewPage = () => (
    <main className="dashboard">
      <section className="dashboard-welcome">
        <div>
          <span className="eyebrow">MOCK INTERVIEW</span>

          <h1>
            {practiceMode === "full"
              ? `Round ${fullRoundIndex + 1} of 4: ${currentRound}`
              : `${currentRound} Interview`}
          </h1>

          <p>
            Question {questionNumber} of{" "}
            {practiceMode === "full" ? 5 : questionCount}
            {" "}· Session ID: {sessionId || "Starting..."}
          </p>
        </div>

        <button
          className="secondary-button"
          onClick={openDashboard}
          disabled={interviewLoading}
        >
          ← Back to Dashboard
        </button>
      </section>

      {interviewMessage && (
        <div className="alert alert-info" role="status">
          {interviewMessage}
        </div>
      )}

      {interviewLoading && !question && !report && (
        <section className="dashboard-card">
          <h2>Preparing your interview...</h2>
          <p>Please wait while the next question is being generated.</p>
        </section>
      )}

      {!sessionId && !interviewLoading && (
        <section className="dashboard-card">
          <h2>No active interview</h2>
          <p>Go to the dashboard and start an interview.</p>
          <button className="primary-button" onClick={openDashboard}>
            Go to Dashboard
          </button>
        </section>
      )}

      {sessionId && questionText && !report && (
        <section className="interview-panel">
          <div className="question-card">
            <span className="question-label">YOUR QUESTION</span>
            <h3>{questionText}</h3>

            <div className="answer-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={speakQuestion}
                disabled={interviewLoading}
              >
                {isSpeaking ? "🔊 Speaking..." : "🔊 Hear Question"}
              </button>

              {isSpeaking && (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={stopSpeaking}
                >
                  ⏹ Stop Voice
                </button>
              )}
            </div>

            <label htmlFor="answer">Your answer</label>
            <textarea
              id="answer"
              rows={6}
              placeholder="Write your answer here..."
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              disabled={Boolean(evaluation) || interviewLoading}
            />

            <div className="answer-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={startVoiceInput}
                disabled={
                  isListening ||
                  interviewLoading ||
                  Boolean(evaluation)
                }
              >
                {isListening
                  ? "🎙️ Listening..."
                  : "🎙️ Answer with Voice"}
              </button>

              <button
                className="primary-button"
                type="button"
                onClick={submitAnswer}
                disabled={
                  interviewLoading ||
                  Boolean(evaluation) ||
                  !answer.trim()
                }
              >
                {interviewLoading ? "Submitting..." : "Submit Answer"}
              </button>
            </div>
          </div>
        </section>
      )}

      {evaluation && !report && (
        <section className="evaluation-card">
          <h3>Answer Submitted</h3>
          <p>Your answer has been saved successfully.</p>

          <div className="interview-actions">
            {!isLastQuestion ? (
              <button
                className="primary-button"
                onClick={() => getNextQuestion()}
                disabled={interviewLoading}
              >
                {interviewLoading ? "Loading..." : "Next Question"}
              </button>
            ) : (
              <button
                className="primary-button"
                onClick={finishCurrentRound}
                disabled={interviewLoading}
              >
                {interviewLoading
                  ? "Generating Report..."
                  : practiceMode === "full" && fullRoundIndex < 3
                  ? `Finish ${currentRound} & Continue`
                  : "Finish Interview & View Report"}
              </button>
            )}
          </div>
        </section>
      )}

      {practiceMode === "full" && roundReports.length > 0 && (
        <section className="round-progress dashboard-card">
          <h3>Completed Rounds</h3>

          {roundReports.map((item) => (
            <div
              className="round-report-item"
              key={`${item.round}-${item.session_id}`}
            >
              <strong>✓ {item.round}</strong>
              <p>Score: {item.overall_score ?? "N/A"} / 10</p>
            </div>
          ))}
        </section>
      )}

      {report && (
        <section className="dashboard-card">
          <h2>Report generated</h2>
          <p>Your report is ready to view.</p>
          <button className="primary-button" onClick={openResultsPage}>
            View Results
          </button>
        </section>
      )}
    </main>
  );

  const renderResultsPage = () => (
    <main className="dashboard">
      <section className="dashboard-welcome">
        <div>
          <span className="eyebrow">INTERVIEW SUMMARY</span>
          <h1>Your Interview Results</h1>
          <p>Review your score and feedback from the AI interviewer.</p>
        </div>
      </section>

      {report ? (
        <>
          {renderReport(report)}

          <div className="interview-actions">
            <button
              className="primary-button"
              onClick={() => {
                resetInterview();
              }}
            >
              Start Another Interview
            </button>

            <button
              className="secondary-button"
              onClick={openDashboard}
            >
              Back to Dashboard
            </button>
          </div>
        </>
      ) : (
        <section className="dashboard-card">
          <h2>No results to display</h2>
          <p>
            Complete an interview first. Your final report will appear here.
          </p>
          <button className="primary-button" onClick={openDashboard}>
            Go to Dashboard
          </button>
        </section>
      )}
    </main>
  );
  return (
    <div className="app">
      <header className="navbar">
        <button
          className="brand"
          onClick={user ? openDashboard : openHome}
          type="button"
        >
          <span className="brand-symbol">AI</span>
          <span>Interview Assistant</span>
        </button>

        <nav className="nav-links">
          {currentPage === "home" && (
            <>
              <button
                className="nav-link"
                onClick={() =>
                  document
                    .getElementById("features")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              >
                Features
              </button>

              <button
                className="secondary-button nav-button"
                onClick={openLogin}
              >
                Login
              </button>

              <button
                className="primary-button nav-button"
                onClick={openRegister}
              >
                Get Started
              </button>
            </>
          )}

          {(currentPage === "login" ||
            currentPage === "register") && (
            <button className="nav-link" onClick={openHome}>
              Home
            </button>
          )}

          {user && currentPage !== "home" && (
            <>
              <button className="nav-link" onClick={openDashboard}>
                Dashboard
              </button>

              {currentPage === "interview" && report && (
                <button
                  className="nav-link"
                  onClick={openResultsPage}
                >
                  Results
                </button>
              )}

              <button
                className="secondary-button nav-button"
                onClick={handleLogout}
              >
                Logout
              </button>
            </>
          )}
        </nav>
      </header>

      {currentPage === "home" && renderHomePage()}

      {(currentPage === "login" ||
        currentPage === "register") &&
        renderAuthPage()}

      {currentPage === "dashboard" &&
        (user ? renderDashboard() : renderAuthPage())}

      {currentPage === "interview" &&
        (user ? renderInterviewPage() : renderAuthPage())}

      {currentPage === "results" &&
        (user ? renderResultsPage() : renderAuthPage())}

      <footer className="footer">
        <p>
          © {new Date().getFullYear()} AI Interview Assistant.
          Practice today. Perform with confidence.
        </p>
      </footer>
    </div>
  );
}

export default App;