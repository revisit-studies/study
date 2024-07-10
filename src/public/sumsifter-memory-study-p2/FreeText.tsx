import React, { useEffect, useState } from 'react';

const TOTAL_TIME = 10 * 60 * 1000; // 10 minutes

function FreeText() {
  const [timeLeft, setTimeLeft] = useState(TOTAL_TIME);
  const [startTime] = useState(Date.now());
  const [timeUp, setTimeUp] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setTimeLeft(TOTAL_TIME - elapsed);
      if (elapsed >= TOTAL_TIME) {
        setTimeUp(true);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [setTimeUp, startTime]);

  return (
    <div>
      <div style={{
        width: 400,
        background: '#fff',
        zIndex: 2,
        color: 'orange',
        fontSize: 16,
        fontWeight: 'bold',
        // transform: 'translateX(-100%)',
      }}
      >
        {timeUp
          ? (
            <p>
              Time Up! Please go to the
              <b> Next</b>
              {' '}
              screen.
            </p>
          )
          : (
            <p>
              {/* minutes */}
              {Math.floor(timeLeft / 1000 / 60)}
              :
              {/* seconds */}
              {Math.floor((timeLeft / 1000) % 60).toString().length === 1 ? '0' : ''}
              {Math.floor((timeLeft / 1000) % 60)}
            </p>
          )}
      </div>

      For the first step, write down everything you can remember having read in the text yesterday.
      You do not need to describe the document each detail comes from, just do your best to re-state as much as you can remember.
      You have
      <b> 10 minutes</b>
      .
      {/* once you click start. */}
    </div>
  );
}

export default FreeText;
