"use client"

import { useState, useEffect } from "react"

export function useCountdown(initialSeconds: number) {
  const [secondsRemaining, setSecondsRemaining] = useState(initialSeconds)

  useEffect(() => {
    if (secondsRemaining <= 0) return

    const intervalId = setInterval(() => {
      setSecondsRemaining((prevSeconds) => prevSeconds - 1)
    }, 1000)

    return () => clearInterval(intervalId)
  }, [secondsRemaining])

  // Convert seconds to hours, minutes, seconds
  const hours = Math.floor(secondsRemaining / 3600)
  const minutes = Math.floor((secondsRemaining % 3600) / 60)
  const seconds = secondsRemaining % 60

  return { hours, minutes, seconds, totalSeconds: secondsRemaining }
}

