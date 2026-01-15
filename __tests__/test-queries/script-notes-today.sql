SELECT
    sn.*
FROM
    ScriptNote sn
WHERE
    sn.scriptType IN (SELECT id FROM userEventScript WHERE scriptid = 'customscript_wwccemployeeaccred')
    AND TRUNC(sn.date) = TRUNC(SYSDATE) -- Limit to today's date
ORDER BY
    sn.internalid DESC
