"use client"

import type React from "react"

import { useState, useRef, useEffect, useCallback } from "react"
import Image from "next/image"
import { Camera, Upload, Clock, X, Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useCountdown } from "@/lib/use-countdown"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

const formatPhoneNumber = (value: string) => {
  if (!value) return value
  const phoneNumber = value.replace(/[^\d]/g, "")
  const phoneNumberLength = phoneNumber.length
  if (phoneNumberLength < 4) return phoneNumber
  if (phoneNumberLength < 7) {
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`
  }
  return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`
}

export default function Home() {
  const [stage, setStage] = useState<"upload" | "countdown">("upload")
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [phoneNumber, setPhoneNumber] = useState("")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [confirmationMessage, setConfirmationMessage] = useState("")
  const [phoneError, setPhoneError] = useState("")
  const [isShaking, setIsShaking] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { hours, minutes, seconds } = useCountdown(24 * 60 * 60)

  // Calculate the countdown time
  const calculateCountdown = () => {
    const targetDate = new Date("March 2, 2025 10:00:00 GMT-0500") // Eastern Time
    const now = new Date()
    const timeDifference = targetDate.getTime() - now.getTime()
    return timeDifference > 0 ? Math.floor(timeDifference / 1000) : 0 // Convert to seconds
  }

  const [countdown, setCountdown] = useState(calculateCountdown())

  useEffect(() => {
    // Check if the user has completed the upload process
    const hasUploaded = localStorage.getItem("hasUploaded")
    if (hasUploaded) {
      setStage("countdown")
    } else {
      setStage("upload")
    }

    // Countdown timer
    const timer = setInterval(() => {
      setCountdown((prevCountdown) => {
        const newCountdown = prevCountdown > 0 ? prevCountdown - 1 : 0
        return newCountdown
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  // Function to format countdown as hh:mm:ss
  const formatCountdown = (seconds: number) => {
    const hours = Math.floor(seconds / 3600).toString().padStart(2, "0")
    const minutes = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0")
    const secs = (seconds % 60).toString().padStart(2, "0")
    return `${hours}:${minutes}:${secs}`
  }

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const newPreviews = newFiles.map((file) => URL.createObjectURL(file));
      console.log("New files selected:", newFiles);
      console.log("New previews generated:", newPreviews);
      setSelectedFiles(newFiles);
      setImagePreviews(newPreviews);
    }
  }, []);

  const handleRemovePhoto = useCallback((index: number) => {
    setSelectedFiles((prevFiles) => prevFiles.filter((_, i) => i !== index))
    setImagePreviews((prevPreviews) => prevPreviews.filter((_, i) => i !== index))
  }, [])

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleAccess = async () => {
    if (selectedFiles.length === 0) return;

    try {
      console.log("Uploading files:", selectedFiles.map((file) => file.name));

      for (const file of selectedFiles) {
        try {
          console.log(`Preparing to upload file: ${file.name}`);
          const response = await fetch("/api/uploadImage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename: file.name, contentType: file.type }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Failed to get signed URL");
          }

          const { uploadUrl, key } = await response.json();
          console.log(`Received signed URL for file: ${file.name}`);

          const uploadResponse = await fetch(uploadUrl, {
            method: "PUT",
            body: file,
            headers: { "Content-Type": file.type },
          });

          if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            console.error("Upload failed:", errorText);
            throw new Error("Failed to upload file");
          }

          console.log(`Successfully uploaded file: ${file.name} to S3`);

          const imageUrl = `https://${process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME}.s3.${process.env.NEXT_PUBLIC_AWS_REGION}.amazonaws.com/${key}`;
          setImagePreviews((prevPreviews) => {
            if (!prevPreviews.includes(imageUrl)) {
              console.log(`Adding image URL to previews: ${imageUrl}`);
              return [...prevPreviews, imageUrl];
            } else {
              console.log(`Duplicate image URL detected, not adding: ${imageUrl}`);
            }
            return prevPreviews;
          });
          setUploadError(null);
        } catch (error) {
          console.error("Error uploading file:", error);
          setUploadError(error instanceof Error ? error.message : "An unknown error occurred");
        }
      }

      console.log("Clearing selected files after successful upload");
      setSelectedFiles([]);
      // Do not clear imagePreviews here to retain the uploaded images

      localStorage.setItem("hasUploaded", "true");
      setStage("countdown");
    } catch (error) {
      console.error("Error uploading images:", error);
    }
  }

  const handleUploadMorePhotos = () => {
    setSelectedFiles([])
    setImagePreviews([])
    setStage("upload")
  }

  const isValidPhoneNumber = (phone: string) => {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/
    return phoneRegex.test(phone)
  }

  const handleNotificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const unformattedPhoneNumber = phoneNumber.replace(/[^\d]/g, "")
    if (!isValidPhoneNumber(unformattedPhoneNumber)) {
      setPhoneError("Please enter a valid phone number")
      setIsShaking(true)
      setTimeout(() => setIsShaking(false), 500)
      return
    }

    try {
      console.log(`Attempting to store phone number: ${unformattedPhoneNumber}`)
      const response = await fetch("/api/storePhoneNumber", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phoneNumber: unformattedPhoneNumber }),
      })

      const contentType = response.headers.get("content-type")
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const responseData = await response.json()
        console.log("API Response:", responseData)

        if (response.ok) {
          console.log(`Successfully received OK response for phone number: ${unformattedPhoneNumber}`)
          setConfirmationMessage("You'll be notified when your photos are ready!")
          setPhoneError("")
          setTimeout(() => {
            setConfirmationMessage("")
            setIsModalOpen(false)
          }, 2000)
        } else {
          console.error("Error response from API:", response.status, responseData)
          throw new Error(responseData.error || "Failed to store phone number")
        }
      } else {
        // Handle non-JSON response
        const text = await response.text()
        console.error("Received non-JSON response:", text)
        throw new Error("Received invalid response from server")
      }
    } catch (error) {
      console.error("Error storing phone number:", error)
      setPhoneError("Failed to save your phone number. Please try again.")
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-black p-4 overflow-hidden">
      <style jsx>{`
        @keyframes scroll-horizontal {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-100%);
          }
        }

        .horizontal-scroll {
          display: flex;
          overflow-x: hidden;
          white-space: nowrap;
          animation: scroll-horizontal 20s linear infinite;
        }

        .horizontal-scroll img {
          height: 100px;
          margin-right: 8px;
          border-radius: 8px;
        }

        @media (min-width: 769px) {
          .horizontal-scroll {
            animation: none;
          }
        }
      `}</style>

      {/* Horizontal scrolling images for mobile */}
      <div className="w-full overflow-x-auto whitespace-nowrap mb-4 md:hidden">
        <div className="horizontal-scroll space-x-4 px-4">
          <div className="relative h-32 w-32 flex-shrink-0">
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/6ff625bf46a27390bd917f37cc8b55ba.jpg-Z3GpPwh4ya5FhaCkQPvYpDna4jjubP.jpeg"
              alt="Vintage collage"
              fill
              className="object-cover rounded-lg shadow-lg"
            />
          </div>
          <div className="relative h-32 w-32 flex-shrink-0">
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/pile-of-developed-film-prints-from-a-disposable-camera.jpg-0S3Sn4NyxKdgJaWYUkKIwNFwxOaI4m.jpeg"
              alt="Film prints"
              fill
              className="object-cover rounded-lg shadow-lg"
            />
          </div>
          <div className="relative h-32 w-32 flex-shrink-0">
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Screenshot%202025-02-28%20at%2010.42.24%E2%80%AFAM-LGBYEFoO5PEvW4UBjXt431Ut4Q7f7R.png"
              alt="Film strip"
              fill
              className="object-cover rounded-lg shadow-lg"
            />
          </div>
          {/* Duplicate images for seamless scrolling */}
          <div className="relative h-32 w-32 flex-shrink-0">
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/6ff625bf46a27390bd917f37cc8b55ba.jpg-Z3GpPwh4ya5FhaCkQPvYpDna4jjubP.jpeg"
              alt="Vintage collage"
              fill
              className="object-cover rounded-lg shadow-lg"
            />
          </div>
          <div className="relative h-32 w-32 flex-shrink-0">
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/pile-of-developed-film-prints-from-a-disposable-camera.jpg-0S3Sn4NyxKdgJaWYUkKIwNFwxOaI4m.jpeg"
              alt="Film prints"
              fill
              className="object-cover rounded-lg shadow-lg"
            />
          </div>
          <div className="relative h-32 w-32 flex-shrink-0">
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Screenshot%202025-02-28%20at%2010.42.24%E2%80%AFAM-LGBYEFoO5PEvW4UBjXt431Ut4Q7f7R.png"
              alt="Film strip"
              fill
              className="object-cover rounded-lg shadow-lg"
            />
          </div>
          <div className="relative h-32 w-32 flex-shrink-0">
            <Image
              src="https://marketplace.canva.com/EAFEHuMtAVM/1/0/1600w/canva-black-analog-film-funeral-video-collage-8Plra2Qs8Eg.jpg"
              alt="Black Analog Film Funeral Video Collage"
              fill
              className="object-cover rounded-lg shadow-lg"
            />
          </div>
          <div className="relative h-32 w-32 flex-shrink-0">
            <Image
              src="https://marketplace.canva.com/EAE-P4EpP1A/1/0/1600w/canva-cream-simple-minimalist-photo-film-photo-collage-14QW9D4FpSw.jpg"
              alt="Cream Simple Minimalist Photo Film Photo Collage"
              fill
              className="object-cover rounded-lg shadow-lg"
            />
          </div>
        </div>
      </div>

      <div className="fixed left-4 top-0 bottom-0 w-48 flex flex-col gap-4 py-4 overflow-hidden pointer-events-none hidden md:flex">
        <div className="animate-scroll flex flex-col gap-4">
          <div className="relative h-64 w-full">
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/6ff625bf46a27390bd917f37cc8b55ba.jpg-Z3GpPwh4ya5FhaCkQPvYpDna4jjubP.jpeg"
              alt="Vintage collage"
              fill
              className="object-cover rounded-lg shadow-lg"
            />
          </div>
          <div className="relative h-48 w-full">
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/pile-of-developed-film-prints-from-a-disposable-camera.jpg-0S3Sn4NyxKdgJaWYUkKIwNFwxOaI4m.jpeg"
              alt="Film prints"
              fill
              className="object-cover rounded-lg shadow-lg"
            />
          </div>
          <div className="relative h-32 w-full">
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Screenshot%202025-02-28%20at%2010.42.24%E2%80%AFAM-LGBYEFoO5PEvW4UBjXt431Ut4Q7f7R.png"
              alt="Film strip"
              fill
              className="object-cover rounded-lg shadow-lg"
            />
          </div>
          <div className="relative h-64 w-full">
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/6ff625bf46a27390bd917f37cc8b55ba.jpg-Z3GpPwh4ya5FhaCkQPvYpDna4jjubP.jpeg"
              alt="Vintage collage"
              fill
              className="object-cover rounded-lg shadow-lg"
            />
          </div>
          <div className="relative h-48 w-full">
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/pile-of-developed-film-prints-from-a-disposable-camera.jpg-0S3Sn4NyxKdgJaWYUkKIwNFwxOaI4m.jpeg"
              alt="Film prints"
              fill
              className="object-cover rounded-lg shadow-lg"
            />
          </div>
          <div className="relative h-32 w-full">
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Screenshot%202025-02-28%20at%2010.42.24%E2%80%AFAM-LGBYEFoO5PEvW4UBjXt431Ut4Q7f7R.png"
              alt="Film strip"
              fill
              className="object-cover rounded-lg shadow-lg"
            />
          </div>
        </div>
      </div>

      <div className="fixed right-4 top-0 bottom-0 w-48 flex flex-col gap-4 py-4 overflow-hidden pointer-events-none hidden md:flex">
        <div className="animate-scroll-reverse flex flex-col gap-4">
          <div className="relative h-48 w-full">
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/pile-of-developed-film-prints-from-a-disposable-camera.jpg-0S3Sn4NyxKdgJaWYUkKIwNFwxOaI4m.jpeg"
              alt="Film prints"
              fill
              className="object-cover rounded-lg shadow-lg"
            />
          </div>
          <div className="relative h-32 w-full">
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Screenshot%202025-02-28%20at%2010.42.24%E2%80%AFAM-LGBYEFoO5PEvW4UBjXt431Ut4Q7f7R.png"
              alt="Film strip"
              fill
              className="object-cover rounded-lg shadow-lg"
            />
          </div>
          <div className="relative h-64 w-full">
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/6ff625bf46a27390bd917f37cc8b55ba.jpg-Z3GpPwh4ya5FhaCkQPvYpDna4jjubP.jpeg"
              alt="Vintage collage"
              fill
              className="object-cover rounded-lg shadow-lg"
            />
          </div>
          <div className="relative h-48 w-full">
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/pile-of-developed-film-prints-from-a-disposable-camera.jpg-0S3Sn4NyxKdgJaWYUkKIwNFwxOaI4m.jpeg"
              alt="Film prints"
              fill
              className="object-cover rounded-lg shadow-lg"
            />
          </div>
          <div className="relative h-32 w-full">
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Screenshot%202025-02-28%20at%2010.42.24%E2%80%AFAM-LGBYEFoO5PEvW4UBjXt431Ut4Q7f7R.png"
              alt="Film strip"
              fill
              className="object-cover rounded-lg shadow-lg"
            />
          </div>
          <div className="relative h-64 w-full">
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/6ff625bf46a27390bd917f37cc8b55ba.jpg-Z3GpPwh4ya5FhaCkQPvYpDna4jjubP.jpeg"
              alt="Vintage collage"
              fill
              className="object-cover rounded-lg shadow-lg"
            />
          </div>
        </div>
      </div>

      <div className="w-full max-w-md z-10">
        <div className="mb-8 flex justify-center">
          <div className="relative h-16 w-48">
            <div className="absolute inset-0 rounded-md p-2">
              <div className="flex h-full items-center justify-center rounded bg-gradient-to-r from-blue-900 via-blue-600 to-blue-300 px-4">
                <h1 className="text-2xl font-bold text-white">photostat</h1>
              </div>
            </div>
          </div>
        </div>

        {stage === "upload" ? (
          <Card className="overflow-hidden border-2 border-blue-400 bg-white p-6 shadow-lg">
            <div className="mb-6 space-y-2 text-center">
              <h1 className="text-2xl font-bold text-gray-900">unlock your memories</h1>
              <h2 className="text-xl font-semibold text-gray-800">see how cute our pics turned out :)</h2>
              <div className="mt-4 flex items-center justify-center space-x-2 rounded-full bg-blue-100 px-4 py-2 text-blue-600">
                <Camera className="h-5 w-5" />
                <p className="font-medium">upload at least 1 party picture to access</p>
              </div>
            </div>

            <div
              className="group mb-6 flex h-48 cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-gray-300 bg-gray-50 p-4 transition-colors hover:border-blue-400 hover:bg-bkue-50"
              onClick={handleUploadClick}
            >
              <Upload className="mb-2 h-10 w-10 text-gray-400 group-hover:text-blue-500" />
              <p className="text-sm text-gray-500 group-hover:text-gray-700">click to upload from your camera roll</p>
              <p className="mt-1 text-xs text-gray-400">JPG, PNG or GIF (max. 10MB each)</p>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*,.heic"
                multiple
                className="hidden"
              />
            </div>

            {uploadError && <div className="mb-4 text-center text-blue-500">Error uploading file: {uploadError}</div>}

            {imagePreviews.length > 0 && (
              <div className="mb-6 grid grid-cols-3 gap-4">
                {imagePreviews.map((preview, index) => (
                  <div key={index} className="relative">
                    <Image
                      src={preview || "/placeholder.svg"}
                      alt={`Preview ${index + 1}`}
                      width={100}
                      height={100}
                      className="rounded-md object-cover w-full h-24"
                    />
                    <button
                      className="absolute -top-2 -right-2 bg-blue-500 text-white rounded-full p-1"
                      onClick={() => handleRemovePhoto(index)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <Button
              className="w-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleAccess}
              disabled={selectedFiles.length === 0}
            >
              access
            </Button>

            <div className="mt-4 flex items-center justify-center">
              <div className="h-1 w-full flex-1 bg-blue-200"></div>
              <div className="mx-2 h-4 w-4 rounded-full bg-blue-400"></div>
              <div className="h-1 w-full flex-1 bg-blue-200"></div>
            </div>
          </Card>
        ) : (
          <Card className="overflow-hidden border-2 border-blue-400 bg-white p-6 shadow-lg">
            <div className="mb-6 space-y-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                <Clock className="h-8 w-8 text-blue-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">photos take 24 hours to develop</h1>
              <h2 className="text-xl font-semibold text-gray-800">check back in</h2>
            </div>

            <div className="mb-8 text-center">
              <div className="text-5xl font-bold text-blue-600">
                {formatCountdown(countdown)}
              </div>
            </div>

            <div className="space-y-4">
              {/*
              <div className="flex items-center space-x-2 rounded-md bg-yellow-100 p-3 text-sm text-yellow-800">
                <div className="flex-shrink-0">
                  <Camera className="h-5 w-5" />
                </div>
                <div>
                  <p>your photos are being processed in our digital darkroom.</p>
                </div>
              </div>
              */}

              <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogTrigger asChild>
                  <Button
                    className="w-full bg-blue-600 text-white hover:bg-blue-700 text-lg"
                    onClick={() => {
                      console.log("Get a text notification button clicked")
                      setIsModalOpen(true)
                    }}
                  >
                    <Bell className="mr-2 h-4 w-4" /> get a text notification
                  </Button>
                </DialogTrigger>
                <DialogContent
                  className="sm:max-w-[425px] bg-white border-2 border-blue-600"
                  onOpenAutoFocus={(e) => {
                    e.preventDefault()
                    console.log("Modal opened")
                  }}
                >
                  <DialogHeader>
                    <DialogTitle>Set up text notification</DialogTitle>
                    <DialogDescription>
                      Enter your phone number to receive a text when your photos are ready.
                    </DialogDescription>
                  </DialogHeader>
                  {confirmationMessage ? (
                    <div className="text-center text-green-600 font-semibold">{confirmationMessage}</div>
                  ) : (
                    <form onSubmit={handleNotificationSubmit} className="space-y-4">
                      <div className={`relative ${isShaking ? "animate-shake" : ""}`}>
                        <Input
                          type="tel"
                          placeholder="(123) 456-7890"
                          value={phoneNumber}
                          onChange={(e) => {
                            const formattedNumber = formatPhoneNumber(e.target.value)
                            setPhoneNumber(formattedNumber)
                            setPhoneError("")
                          }}
                          required
                          className={`${phoneError ? "border-red-500" : "border-blue-600"} border-2`}
                        />
                        {phoneError && <p className="text-red-500 text-sm mt-1">{phoneError}</p>}
                      </div>
                      <Button type="submit" className="w-full bg-blue-600 text-white hover:bg-blue-700">
                        Submit
                      </Button>
                    </form>
                  )}
                </DialogContent>
              </Dialog>

              <Button
                variant="outline"
                className="w-full border-blue-400 text-blue-600 hover:bg-blue-50 hover:text-blue-700 text-lg"
                onClick={handleUploadMorePhotos}
              >
                upload more
              </Button>
            </div>

            <div className="mt-6">
              <div className="relative h-12">
                <div className="absolute inset-0 overflow-hidden">
                  {[...Array(10)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute h-12 w-12 rounded-sm border-2 border-gray-800 bg-gray-200"
                      style={{
                        left: `${i * 40}px`,
                        transform: "rotate(5deg)",
                      }}
                    >
                      <div className="absolute bottom-0 left-0 right-0 top-0 flex items-center justify-center">
                        <div className="h-2 w-2 rounded-full bg-gray-800"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </main>
  )
}
