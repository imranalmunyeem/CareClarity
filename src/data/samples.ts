export interface SampleLetter {
  id: string;
  name: string;
  label: string;
  text: string;
}

export const sampleLetters: SampleLetter[] = [
  {
    id: "outpatient",
    name: "Outpatient appointment",
    label: "Outpatient clinic",
    text: `Northbridge NHS Foundation Trust
Outpatient Appointment Service

Dear Patient,

We have arranged an outpatient appointment for you with the Respiratory Clinic.

Appointment date: Tuesday 18 June 2026
Time: 10:40am
Location: Level 2, Green Wing, Northbridge Hospital, Mill Road, NB1 4AA
Hospital number: NB-482019

Please arrive 10 minutes before your appointment. Bring this letter, a list of your current medicines and any forms you have been asked to complete.

If you cannot attend, please call the booking team on 0300 123 4567 as soon as possible so the appointment can be offered to another patient.

This letter is about your appointment arrangements only.`,
  },
  {
    id: "waiting-list",
    name: "Referral waiting list",
    label: "Waiting list update",
    text: `South Vale Integrated Care Service
Referral Management Centre

Dear Patient,

Your GP referral to the Community Musculoskeletal Service has been received and added to the waiting list.

Referral reference: RMS-78241
Referral received: 2 May 2026
Current estimated wait: approximately 12 to 16 weeks from the referral date.

You do not need to call us to confirm the referral. We will contact you when an appointment is ready to book. Please tell your GP practice if your address or phone number changes.

For referral admin queries, contact 020 7946 0182 Monday to Friday, 9am to 5pm.`,
  },
  {
    id: "test-instructions",
    name: "Test instructions",
    label: "Clinic test",
    text: `Rivergate Diagnostic Centre
Blood Test Appointment

Dear Patient,

You have been booked for a blood test requested by your hospital team.

Date: 7 July 2026
Time: 08:20
Location: Rivergate Diagnostic Centre, 14 Station Approach, RG2 8DL
Booking reference: BT-34176

Please bring photo ID if available and this appointment letter. The letter says you may need to fast, but it does not clearly state for how long.

If you are unable to attend, call 0113 555 0170 to rearrange.`,
  },
];
