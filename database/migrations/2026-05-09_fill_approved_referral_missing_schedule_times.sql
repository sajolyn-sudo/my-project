UPDATE referrals
SET referral_time = '09:00:00'
WHERE referred_date IS NOT NULL
  AND referral_time IS NULL
  AND LOWER(status) IN (
    'approved',
    'complete',
    'completed',
    'closed',
    'resolved',
    'ongoing',
    'reviewed'
  );
