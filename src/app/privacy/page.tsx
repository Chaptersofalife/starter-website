// The Privacy Policy page: chaptersofalife...com/privacy
// This is a draft. Have it checked before the site takes real orders.
import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/LegalPage";
import { contactEmail } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Chapters of a Life collects, uses and protects your personal information.",
};

const email = <a href={`mailto:${contactEmail}`}>{contactEmail}</a>;

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated="13 November 2026">
      <p className="legal-intro">
        When you make a memorial book with us, you trust us with precious
        memories and photographs, often at a difficult time. This policy
        explains, as simply as we can, what information we collect, why we
        need it, how we look after it, and the choices you have.
      </p>

      <h2>Who we are</h2>
      <p>
        Chapters of a Life is a small UK business that makes personalised
        memorial books. We are responsible for the personal information
        described in this policy, which makes us the &ldquo;controller&rdquo;
        under UK data protection law (the UK General Data Protection
        Regulation, or UK GDPR, and the Data Protection Act 2018).
      </p>
      <p>
        If you have any questions about your information, please email us at{" "}
        {email}. We are always happy to help.
      </p>

      <h2>Who this policy is for</h2>
      <ul>
        <li>
          <strong>Organisers</strong>: the person who starts a book, invites
          others and orders the printed copy.
        </li>
        <li>
          <strong>Contributors</strong>: family and friends who add memories,
          photographs and favourite sayings using a private link.
        </li>
        <li>
          <strong>Visitors</strong>: anyone who browses our website or sends
          us a message.
        </li>
      </ul>

      <h2>The information we collect</h2>

      <h3>If you organise a book</h3>
      <ul>
        <li>Your name and email address, and the details you use to sign in.</li>
        <li>The delivery name, address and phone number for your printed book.</li>
        <li>
          Details of your order and payment, such as what you bought and when.
          Your card details are handled by our payment provider, Stripe. We
          never see or store your full card number.
        </li>
        <li>
          The details of your loved one that you add to start the book, such as
          their name, dates and photograph.
        </li>
        <li>The choices you make about what goes into the book.</li>
      </ul>

      <h3>If you contribute to a book</h3>
      <ul>
        <li>Your name, so the organiser and family know who shared each memory.</li>
        <li>Your email address, if you choose to give it.</li>
        <li>The memories, photographs and sayings you add.</li>
      </ul>

      <h3>If you contact us</h3>
      <p>
        Your name, email address and anything you write in your message.
      </p>

      <h3>When you visit our website</h3>
      <p>
        Basic technical information, such as your browser type and the pages
        you visit. Our hosting provider keeps this for a short time to keep the
        site running safely and to protect it from misuse.
      </p>

      <h2>Information about people who have died, and about others</h2>
      <p>
        UK data protection law protects living people. It does not cover
        information about people who have died. Even so, we treat every memory
        and photograph of your loved one with the same care as any other
        personal information.
      </p>
      <p>
        Memories and photographs often include other people who are still
        living, such as family members and friends. That information is
        protected, and we look after it carefully. Memories can also sometimes
        mention sensitive things, such as health, religion or beliefs. We only
        use them to make the book you have asked for.
      </p>
      <p>
        If you add photographs or stories that include other living people,
        please only share what you believe they would be comfortable with.
      </p>

      <h2>How we use your information, and why</h2>
      <p>
        Data protection law says we must have a lawful reason (a &ldquo;lawful
        basis&rdquo;) for each way we use your information. Ours are:
      </p>
      <ul>
        <li>
          <strong>To make and deliver your book</strong>, including setting up
          your account, inviting contributors, showing you a preview, taking
          payment, printing and delivery. We do this to carry out our contract
          with you.
        </li>
        <li>
          <strong>To collect memories from contributors</strong> and include
          them in the book the organiser has asked for. We do this because it
          is in our and the organiser&rsquo;s legitimate interests, and it is
          what contributors expect when they choose to take part.
        </li>
        <li>
          <strong>To reply to your messages</strong> and help with any
          questions. This is in our legitimate interests in running our
          business and looking after our customers.
        </li>
        <li>
          <strong>To keep records</strong> of orders and payments, because the
          law requires it, for example for tax.
        </li>
        <li>
          <strong>To keep our website and your information secure</strong> and
          prevent fraud. This is in our legitimate interests and yours.
        </li>
      </ul>
      <p>
        Where memories include sensitive information, such as health or
        religious beliefs, we rely on your explicit consent, which you give
        when you choose to add it to the book. You can withdraw it at any time
        by asking us to remove that memory.
      </p>
      <p>
        We will never sell your information, and we will not send you
        marketing emails unless you have asked us to. If you ever do sign up
        for updates, you can stop them at any time.
      </p>

      <h2>Who can see the book</h2>
      <p>
        A book is private. Only the organiser and the people they send the
        private link to can see it and add to it. It is never shown publicly.
        Anyone with the link can view and add to the book, so please share it
        only with people you trust.
      </p>
      <p>
        The organiser can see every memory and photograph contributors add,
        and chooses what goes into the finished book.
      </p>

      <h2>Who we share your information with</h2>
      <p>
        We use a small number of trusted companies to help us run our service.
        They only use your information to provide their service to us, and
        they must keep it safe.
      </p>
      <ul>
        <li><strong>Netlify</strong>, which hosts our website and receives messages from our contact form.</li>
        <li><strong>Supabase</strong>, which securely stores accounts, memories and photographs.</li>
        <li><strong>Stripe</strong>, which processes card payments safely.</li>
        <li><strong>Google</strong>, which provides our email, so we can reply to you.</li>
        <li>
          <strong>The printing and delivery companies</strong> that print your
          book and bring it to your door. They receive the finished book and
          your delivery details.
        </li>
      </ul>
      <p>
        We may also share information if the law requires us to, for example
        with HM Revenue &amp; Customs.
      </p>

      <h2>Information stored outside the UK</h2>
      <p>
        Some of the companies we use store information outside the UK, for
        example in the United States or the European Union. When this happens,
        we make sure your information is protected to UK standards, for example
        through the UK&ndash;US &ldquo;data bridge&rdquo;, UK adequacy
        regulations, or contracts approved by the UK Information
        Commissioner&rsquo;s Office.
      </p>

      <h2>How long we keep your information</h2>
      <ul>
        <li>
          <strong>Book content</strong> (memories, photographs and sayings): we
          keep it for 12 months after your book is delivered, so you can order
          extra copies, and then delete it. You can ask us to delete it sooner
          at any time.
        </li>
        <li>
          <strong>Your account</strong>: until you ask us to close it, or after
          two years without use.
        </li>
        <li>
          <strong>Order and payment records</strong>: for six years, because
          UK tax law requires it.
        </li>
        <li>
          <strong>Messages you send us</strong>: for up to two years, so we can
          refer back to them if you get in touch again.
        </li>
      </ul>

      <h2>Keeping your information safe</h2>
      <p>
        We use secure, reputable providers, encrypted connections and private
        links, and we limit who can see your information. No system can be
        completely secure, but we take care to protect what you share with us.
      </p>

      <h2>Cookies</h2>
      <p>
        We only use cookies that are needed for our website to work, such as
        keeping you signed in and helping our payment provider prevent fraud.
        We do not use advertising or tracking cookies. If this changes, we
        will update this policy and ask for your permission first.
      </p>

      <h2>Your rights</h2>
      <p>Under UK GDPR, you have the right to:</p>
      <ul>
        <li>ask for a copy of the information we hold about you;</li>
        <li>ask us to correct anything that is wrong;</li>
        <li>ask us to delete your information;</li>
        <li>ask us to limit how we use it, or object to how we use it;</li>
        <li>ask for your information in a format you can take elsewhere; and</li>
        <li>withdraw your permission, where we rely on it.</li>
      </ul>
      <p>
        To use any of these rights, email us at {email}. There is no charge,
        and we will reply within one month. If a contributor would like their
        memories removed from a book, they can ask the organiser or contact us
        directly. Once a book has been printed, we cannot change copies that
        have already been made.
      </p>

      <h2>Children</h2>
      <p>
        Organisers must be 18 or over. Children are welcome to share memories,
        with the help of a parent or guardian.
      </p>

      <h2>If you are unhappy</h2>
      <p>
        Please talk to us first at {email}, and we will do our best to put
        things right. You also have the right to complain to the Information
        Commissioner&rsquo;s Office (ICO), the UK&rsquo;s data protection
        regulator, at <a href="https://ico.org.uk/make-a-complaint/">ico.org.uk</a>{" "}
        or by calling 0303 123 1113.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        We may update this policy from time to time. When we do, we will
        change the date at the top of this page, and if the changes are
        important we will let you know.
      </p>

      <p className="legal-related">
        Please also read our <Link href="/terms">Terms &amp; Conditions</Link>.
      </p>
    </LegalPage>
  );
}
