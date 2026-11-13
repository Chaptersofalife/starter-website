// The "How it works" page: chaptersofalife...com/how-it-works
import type { Metadata } from "next";
import StartBookButton from "@/components/StartBookButton";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "How a Chapters of a Life memorial book comes together, in seven simple steps.",
};

// The seven steps. Edit the wording here.
const steps = [
  {
    title: "Start a book",
    text: "Begin with your loved one's name, the dates of their life and a favourite photograph of them.",
  },
  {
    title: "Invite family and friends",
    text: "Share a private link with the people who knew and loved them, so they can be part of the book too.",
  },
  {
    title: "Everyone adds their memories",
    text: "Each person can add their own memories, photographs and the favourite sayings they remember. There is no rush.",
  },
  {
    title: "Choose what goes in",
    text: "You read through everything that has been shared and choose what goes into the book.",
  },
  {
    title: "The book closes",
    text: "On a date you choose, the book closes to new memories, so everyone knows when to add theirs.",
  },
  {
    title: "See a preview and approve it",
    text: "You look through a preview of the finished book. Nothing is printed until you have approved it.",
  },
  {
    title: "Delivered to your door",
    text: "Your printed book is delivered to your door, ready to keep, to share and to pass down.",
  },
];

export default function HowItWorksPage() {
  return (
    <main>
      <section className={styles.intro}>
        <div className="container">
          <div className="reading">
            <h1>How it works</h1>
            <p className={styles.lead}>
              Creating a memorial book is a shared act of remembering. Here is
              how it comes together, one gentle step at a time.
            </p>
          </div>
        </div>
      </section>

      <section className={styles.stepsSection}>
        <div className="container">
          <ol className={styles.steps}>
            {steps.map((step, index) => (
              <li key={step.title} className={styles.step}>
                <span className={styles.number} aria-hidden="true">
                  {index + 1}
                </span>
                <div className={styles.stepText}>
                  <h2>
                    <span className="visually-hidden">Step {index + 1}: </span>
                    {step.title}
                  </h2>
                  <p>{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={`section section-soft ${styles.closing}`}>
        <div className="container">
          <div className={styles.closingInner}>
            <h2>Ready to begin?</h2>
            <p>
              Start whenever you are ready. You can save your progress and come
              back at any time.
            </p>
            <div className="actions">
              <StartBookButton />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
