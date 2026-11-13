// The home page of the website.
//
// Text marked with <Placeholder> is waiting for your own words.
// Search for "PLACEHOLDER" to find each one.
// The other text is a draft written for you: change any of it freely.

import Placeholder from "@/components/Placeholder";
import styles from "./page.module.css";

// The three "How it works" steps. Edit the wording here.
const steps = [
  {
    title: "Share their story",
    text: "Add photographs, memories and the words that matter most. Take as long as you need, and invite family and friends to add theirs.",
  },
  {
    title: "We shape it into a book",
    text: "We gently arrange everything into chapters of a life, with care for every photograph and every word. You see each page before anything is printed.",
  },
  {
    title: "A book to keep",
    text: "Your finished book is beautifully printed and bound, then sent to your door, ready to hold, share and pass down.",
  },
];

// The sample book pages. Replace each box with a real photo when you have one.
const samplePages = [
  { label: "The cover", caption: "A cover with their name and a favourite photograph." },
  { label: "A chapter opening", caption: "Each chapter begins a new part of their life." },
  { label: "Photographs and memories", caption: "Pictures and stories side by side." },
];

// "Start a book" does nothing yet.
// TODO: link it to the book builder once that page exists.
function StartBookButton() {
  return (
    <button type="button" className="button">
      Start a book
    </button>
  );
}

export default function Home() {
  return (
    <main>
      {/* ---------- Opening: what Chapters of a Life is ---------- */}
      <section className={styles.hero}>
        <div className="container">
          <div className="reading">
            <h1>Every life is a story worth keeping</h1>

            <div className={styles.intro}>
              <p>
                Chapters of a Life creates personalised memorial books that
                gather the photographs, memories and words of someone you love
                into one beautiful keepsake.
              </p>
              <p>
                We guide you through each step at your own pace, so you can
                focus on remembering while we take care of the rest.
              </p>
              {/* PLACEHOLDER: a sentence about you */}
              <Placeholder hint="a sentence about who you are and why you make these books">
                <p>
                  Write one or two sentences here about yourself and why you
                  started Chapters of a Life.
                </p>
              </Placeholder>
            </div>

            <div className="actions">
              <StartBookButton />
              <a href="#how-it-works" className="button button-secondary">
                See how it works
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- How it works: 3 steps ---------- */}
      <section id="how-it-works" className="section section-soft">
        <div className="container">
          <div className={styles.sectionHead}>
            <h2>How it works</h2>
            <p>Three simple steps, with help whenever you need it.</p>
          </div>

          <ol className={styles.steps}>
            {steps.map((step, index) => (
              <li key={step.title} className={styles.step}>
                <span className={styles.stepNumber} aria-hidden="true">
                  {index + 1}
                </span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>

          {/* PLACEHOLDER: practical details */}
          <div className={styles.details}>
            <Placeholder hint="practical details: how long it takes, delivery, price">
              <p>
                Add the practical details families will want to know, for
                example how long a book takes, where you deliver and what it
                costs.
              </p>
            </Placeholder>
          </div>
        </div>
      </section>

      {/* ---------- Sample book pages ---------- */}
      <section className="section">
        <div className="container">
          <div className={styles.sectionHead}>
            <h2>A look inside</h2>
            <p>A few pages from books we have made.</p>
          </div>

          <div className={styles.samples}>
            {samplePages.map((page) => (
              <figure key={page.label} className={styles.sample}>
                {/* PLACEHOLDER: replace this box with a photo of a real page */}
                <div className={styles.samplePage}>
                  <span className={styles.samplePageLabel}>
                    {page.label}
                    <span className={styles.samplePageNote}>Sample page coming soon</span>
                  </span>
                </div>
                <figcaption>{page.caption}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Closing invitation ---------- */}
      <section className={`section section-soft ${styles.closing}`}>
        <div className="container">
          <div className={styles.closingInner}>
            <h2>Begin their story</h2>
            <p>
              Start whenever you are ready. You can save your progress and come
              back at any time.
            </p>
            {/* PLACEHOLDER: a personal note */}
            <Placeholder hint="a short, warm note from you, signed with your name">
              <p>
                A few words from you to the families who visit, signed with
                your first name.
              </p>
            </Placeholder>
            <div className="actions" style={{ justifyContent: "center" }}>
              <StartBookButton />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
