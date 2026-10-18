/**
 * Terms of Service content for the customer app.
 *
 * The sections live here (instead of in the template) so the policies can be
 * reviewed and updated in one place.
 */

/** Bump this whenever the wording below changes. */
export const TERMS_LAST_UPDATED = 'October 18, 2026';

export interface TermsSection {
  /** Stable id, also used as the in-page anchor. */
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

/**
 * Contact details shown in the final section. These mirror the values in
 * `COMPANY_CONTACT` (`pages/contact-us/contact-us.page.ts`) and are kept here
 * so the legal content stays a single, reviewable document.
 */
export const TERMS_CONTACT = {
  email: 'bistrobuddies@gmail.com',
  phone: '09123456789',
  location: 'Quezon City, Philippines',
} as const;

export const TERMS_SECTIONS: TermsSection[] = [
  {
    id: 'acceptance',
    title: '1. Acceptance of Terms',
    paragraphs: [
      'These Terms of Service ("Terms") govern your use of the BistroBuddies mobile app and the coffee ordering service offered through it. The app is operated by BistroBuddies.',
      'By creating an account, signing in, browsing, or placing an order, you confirm that you have read, understood, and agree to be bound by these Terms.',
      'If you do not agree with these Terms, please do not use the app or place an order.',
    ],
  },
  {
    id: 'eligibility',
    title: '2. Eligibility and Account Responsibilities',
    paragraphs: [
      'You must provide accurate and complete information when you create an account, such as your name, email address, and mobile number, and you must keep it up to date.',
      'You are responsible for keeping your password confidential and for all activity that happens under your account. Please contact us immediately if you believe your account has been used without your permission.',
    ],
    bullets: [
      'Use a password you do not reuse on other services.',
      'Do not share your account with other people.',
      'Keep your contact details current so we can reach you about your orders.',
    ],
  },
  {
    id: 'products',
    title: '3. Products, Sizes, Prices, and Availability',
    paragraphs: [
      'Coffee is offered in three sizes: Small, Medium, and Large. Sugar and other options are listed on each product page.',
      'Prices are set per product and are shown in the app. Our standard size pricing is Small ₱100, Medium ₱120, and Large ₱150. The exact price for each product and size is the price displayed in the app and confirmed by our system at the time you place your order.',
      'Product availability can change. If an item is unavailable, our system will not accept an order for that item.',
    ],
  },
  {
    id: 'ordering',
    title: '4. Ordering and Order Confirmation',
    paragraphs: [
      'You must be signed in to place an order. Your order is sent to BistroBuddies for processing and is only created once our system accepts it.',
      'After an order is placed, the app shows a confirmation with your order ID, the items, and the amounts calculated by our system. The amounts shown at confirmation are the authoritative total for that order.',
    ],
  },
  {
    id: 'cod',
    title: '5. Cash on Delivery (COD)',
    paragraphs: [
      'If you choose Cash on Delivery (COD), you pay in cash when you receive your order. No online payment is taken for a COD order.',
      'The payment status of a COD order is recorded as the order is completed. The order can be prepared before the cash payment is collected.',
    ],
  },
  {
    id: 'gcash',
    title: '6. GCash Payments and Manual Payment Verification',
    paragraphs: [
      'If you choose GCash, you scan the official BistroBuddies GCash QR code shown in the app, pay the exact total shown, and then enter the GCash account name and mobile number you paid from.',
      'GCash payments are verified manually by our team. There is no automatic payment verification and no third-party online payment gateway.',
      'Once you submit your GCash details, the payment status becomes "Verifying". Our team then records the payment as "Paid" or, if it cannot be matched to a payment we received, as "Payment rejected". If a payment is rejected, you can review your GCash payment and submit your details again.',
    ],
  },
  {
    id: 'order-status',
    title: '7. Order Preparation and Status Updates',
    paragraphs: [
      'Orders move through the following statuses: Pending, Confirmed, Preparing, Ready, Completed, and Cancelled.',
      'You can follow your order status in My Orders, where updates appear as they are recorded.',
    ],
  },
  {
    id: 'cancellations',
    title: '8. Cancellations and Refunds',
    paragraphs: [
      'You can cancel your own order from the order details screen only while its status is "Pending" (before BistroBuddies has confirmed it). Once an order is confirmed, it can no longer be cancelled from the app. Please contact us as soon as possible if something is wrong with a confirmed order.',
      'If an order is cancelled after a payment was made, any refund is handled by BistroBuddies and its status is recorded on the order (for example, "Refund pending" or "Refund completed"). The app only displays the refund information recorded by BistroBuddies; it does not process refunds itself.',
    ],
  },
  {
    id: 'delivery',
    title: '9. Delivery and Customer Contact Information',
    paragraphs: [
      'You must provide an accurate recipient name, contact number, and delivery address at checkout. Your order depends on our ability to reach you and deliver to the address you provide.',
      'We may contact you using the phone number you provide to confirm or deliver an order.',
    ],
  },
  {
    id: 'acceptable-use',
    title: '10. Acceptable Use',
    paragraphs: [
      'Use the app only for lawful, personal ordering purposes.',
    ],
    bullets: [
      'Do not submit false or misleading information, and do not impersonate another person.',
      'Do not attempt to interfere with, disrupt, or gain unauthorised access to the app, our systems, or another customer’s account.',
      'Do not use the app to place orders you do not intend to pay for.',
    ],
  },
  {
    id: 'privacy',
    title: '11. Privacy and Personal Information',
    paragraphs: [
      'We collect and use the information you provide to create your account, process and deliver your orders, verify payments, and contact you about your orders. This includes your name, email address, mobile number, delivery address, and order details.',
      'Your information is used to operate the service and is not sold to third parties.',
      'We take reasonable measures to protect the personal information you provide. You may contact us using the details in this page to ask about or update the information associated with your account.',
    ],
  },
  {
    id: 'service',
    title: '12. Service Availability and Changes',
    paragraphs: [
      'The app and the ordering service are provided on an "as is" and "as available" basis. We do not guarantee uninterrupted or error-free operation.',
      'We may change, suspend, or discontinue parts of the service, and we may correct pricing or availability errors before an order is confirmed.',
    ],
  },
  {
    id: 'updates',
    title: '13. Updates to These Terms',
    paragraphs: [
      'We may update these Terms from time to time. When we do, we will update the "Last updated" date on this page.',
      'Your continued use of the app after the updated Terms take effect means you accept the revised Terms.',
    ],
  },
  {
    id: 'contact',
    title: '14. Contact Information',
    paragraphs: [
      'If you have questions about these Terms or about an order, please contact us using the details below, or through the in-app Contact Us page.',
    ],
  },
];
