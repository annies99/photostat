import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase environment variables")
  throw new Error("Missing Supabase environment variables")
}

const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST(request: Request) {
  try {
    const { phoneNumber } = await request.json()
    console.log(`Received request to store phone number: ${phoneNumber}`)

    // Log Supabase connection details (be careful not to log the actual key)
    console.log(`Supabase URL: ${supabaseUrl}`)
    console.log(`Supabase key is set: ${!!supabaseKey}`)

    // Attempt to insert the phone number
    const { data, error } = await supabase.from("phone_numbers").insert([{ phone_number: phoneNumber }])

    if (error) {
      console.error("Error inserting phone number into Supabase:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (data) {
      console.log("Inserted data:", data)
    } else {
      console.log("No data returned from insert operation")
    }

    console.log(`Successfully stored phone number in Supabase: ${phoneNumber}`)
    return NextResponse.json({ message: "Phone number stored successfully" }, { status: 200 })
  } catch (error) {
    console.error("Error in storePhoneNumber API route:", error)
    return NextResponse.json({ error: "Failed to store phone number" }, { status: 500 })
  }
}

