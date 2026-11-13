// The "Contact" page: chaptersofalife...com/contact
import type { Metadata } from "next";
import ContactForm from "@/components/ContactForm";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Send Chapters of a Life a message, or find answers to common questions about making a memorial book.",
};

// Common questions. Edit the wording here.
const questions = [
  {
    question: "How long does it take to make a book?",
    answer:
      "It depends mostly on you. Family and friends can add their memories until the closing date you choose, so you can give everyone as much time as they need. After the book closes, you choose what goes in and look through a preview. Once you approve it, we print your book and deliver it to your door.",
  },
  {
    question: "Who can add memories?",
    answer:
      "Anyone you invite. You share a private link with family and friends, and each person can add their own memories, photographs and favourite sayings until the book closes.",
  },
  {
    question: "Do family and friends need an account?",
    answer:
      "No. They simply open the private link you send them and add their memories. Only you, as the person who starts the book, need an account.",
  },
  {
    question: "Is the book private?",
    answer:
      "Yes. Only the people you send the private link to can see the book and add to it. It is never shown publicly.",
  },
  {
    question: "Can I see the book before it is printed?",
    answer:
      "Yes. You look through a preview of the finished book first. Nothing is printed until you have approved it.",
  },
];

export default function ContactPage() {
  return (
    <main>
      <section className={styles.intro}>
        <div className="container">
          <div className="reading">
            <h1>Contact us</h1>
            <p className={styles.lead}>
              If you have a question, or would simply like to talk things
              through before you begin, send us a message. We will reply by
              email as soon as we can.
            </p>
          </div>
        </div>
      </section>

      <section className={styles.body}>
        <div className={`container ${styles.columns}`}>
          <div className={styles.formColumn}>
            <ContactForm />
          </div>

          <div className={styles.faq}>
            <h2>Common questions</h2>
            <dl className={styles.questions}>
              {questions.map((item) => (
                <div key={item.question} className={styles.question}>
                  <dt>{item.question}</dt>
                  <dd>{item.answer}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>
    </main>
  );
}
