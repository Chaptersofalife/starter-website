// The Terms & Conditions page: chaptersofalife...com/terms
// This is a draft. Have it checked before the site takes real orders.
import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/LegalPage";
import { contactEmail } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "The terms for using Chapters of a Life and ordering a personalised memorial book.",
};

const email = <a href={`mailto:${contactEmail}`}>{contactEmail}</a>;

export default function TermsPage() {
  return (
    <LegalPage title="Terms & Conditions" lastUpdated="13 November 2026">
      <p className="legal-intro">
        These terms explain how our service works and what we each agree to
        when you use our website or order a memorial book. We have tried to
        keep them short and clear. If anything is unclear, please ask us.
      </p>

      <h2>About us</h2>
      <p>
        Chapters of a Life is a small UK business that makes personalised
        memorial books. You can contact us at any time at {email}.
      </p>
      <p>
        By using our website, starting a book or adding memories, you agree to
        these terms. Please also read our{" "}
        <Link href="/privacy">Privacy Policy</Link>, which explains how we look
        after your information.
      </p>

      <h2>How our service works</h2>
      <p>
        An organiser starts a book and invites family and friends with a
        private link. Everyone adds their memories, photographs and favourite
        sayings. On a date the organiser chooses, the book closes. The
        organiser chooses what goes in, looks through a preview and approves
        it. We then print the book and deliver it.
      </p>

      <h2>If you organise a book</h2>
      <ul>
        <li>You must be 18 or over and live in the UK.</li>
        <li>Please keep your sign-in details safe and do not share them.</li>
        <li>
          You decide who receives the private link. Anyone with the link can
          view and add to the book, so please share it only with people you
          trust.
        </li>
        <li>
          You choose which memories and photographs go into the book, and you
          are responsible for checking the preview carefully before you
          approve it.
        </li>
      </ul>

      <h2>If you add memories and photographs</h2>
      <p>This applies to everyone who adds to a book, including organisers.</p>
      <ul>
        <li>
          Please only add photographs you took yourself, or that you have
          permission to share.
        </li>
        <li>
          Please be kind and respectful. Do not add anything unlawful,
          hurtful or offensive, or anything that shares other people&rsquo;s
          private information without their agreement.
        </li>
        <li>
          Your memories and photographs stay yours. By adding them, you give us
          permission to store them, show them to the organiser and the people
          they invite, and print them in the book. We will not use them for
          anything else, such as advertising, without asking you first.
        </li>
        <li>
          The organiser decides what goes into the finished book, so not every
          memory may be included.
        </li>
        <li>
          We may remove anything that breaks these terms. We will always try to
          talk to the organiser first.
        </li>
      </ul>

      <h3>Keep your own copies</h3>
      <p>
        Please keep your original photographs and any writing you treasure. We
        store copies only for as long as our{" "}
        <Link href="/privacy">Privacy Policy</Link> explains, and we cannot
        return originals or guarantee that copies will be kept forever.
      </p>

      <h2>Ordering and payment</h2>
      <ul>
        <li>
          The price of your book, including delivery, is shown in pounds
          sterling before you pay.
        </li>
        <li>
          Payments are made by card through Stripe, a secure payment provider.
          We never see or store your full card number.
        </li>
        <li>
          Our contract with you begins when we confirm your order by email.
        </li>
        <li>
          If we make a mistake with a price, we will contact you before going
          ahead, and you can cancel for a full refund.
        </li>
      </ul>

      <h2>Your preview and approval</h2>
      <p>
        Before anything is printed, we show you a preview of the finished
        book. Please take your time to check names, dates, spelling and
        photographs. Nothing is printed until you approve it. Once you approve
        the preview, we will print the book exactly as shown.
      </p>

      <h2>Changing your mind</h2>
      <p>
        Because every book is personalised and made especially for you, the
        usual 14-day right to cancel online orders does not apply once
        printing has begun. If you would like to cancel before you approve the
        preview, please email us at {email} and we will refund you in full.
      </p>

      <h2>Delivery</h2>
      <ul>
        <li>We deliver to addresses in the UK.</li>
        <li>
          Any delivery time we give is an estimate. If there is a delay, we
          will let you know.
        </li>
        <li>
          Please check your delivery address carefully. If a book is lost
          because the address given was wrong, we may need to charge for a
          replacement.
        </li>
        <li>The book becomes yours once it is delivered.</li>
      </ul>

      <h2>If something is wrong with your book</h2>
      <p>
        We take great care with every book. If yours arrives damaged, has a
        printing fault, or does not match the preview you approved, please
        email us at {email} within 30 days, with a photograph if you can. We
        will reprint it or give you a refund.
      </p>
      <p>
        We cannot reprint for free if the mistake was in the content you
        approved, such as a misspelt name in the preview. We will always try
        to help, and can offer a corrected copy at a reduced price.
      </p>
      <p>
        Nothing in these terms affects your legal rights as a consumer under
        the Consumer Rights Act 2015. For more information, you can contact
        Citizens Advice.
      </p>

      <h2>Our responsibility to you</h2>
      <p>
        If we do not keep to these terms, we are responsible for loss or damage
        you suffer that was a foreseeable result of our failing. We are not
        responsible for loss that was not foreseeable, or for business losses.
      </p>
      <p>
        We do not limit our responsibility where it would be unlawful to do so,
        including for death or personal injury caused by our negligence, or
        for fraud.
      </p>

      <h2>If we need to stop</h2>
      <p>
        We may suspend or end an account that seriously or repeatedly breaks
        these terms. If we ever have to stop providing our service, we will
        give you as much notice as we can and refund anything you have paid
        for a book we have not delivered.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        We may update these terms from time to time. The version that applies
        to your order is the one shown when you placed it. We will change the
        date at the top of this page whenever we make an update.
      </p>

      <h2>The law that applies</h2>
      <p>
        These terms are governed by the law of England and Wales. If you live
        in Scotland or Northern Ireland, you can also bring a claim in the
        courts where you live.
      </p>

      <h2>Contact us</h2>
      <p>
        If you have any questions about these terms, or if anything has gone
        wrong, please email us at {email}. We will reply as soon as we can.
      </p>

      <p className="legal-related">
        Please also read our <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </LegalPage>
  );
}
