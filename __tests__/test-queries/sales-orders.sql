SELECT
  id,
  tranid,
  trandate,
  total
FROM transaction
WHERE type = 'SalesOrd'
  AND trandate >= :startDate
  AND ROWNUM <= :limit
ORDER BY trandate DESC
