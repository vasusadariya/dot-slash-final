import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "../../../lib/auth"
import { connectWithRetry } from "../../../lib/mongodb"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const client = await connectWithRetry()
    const db = client.db("dotslash")

    let query = {}

    // Regular users can only see their own complaints
    if (session.user.role === "user") {
      query = { userId: session.user.id }
    }
    // Admin can see all complaints

    const complaints = await db.collection("complaints").find(query).sort({ createdAt: -1 }).toArray()

    return NextResponse.json({
      success: true,
      complaints: complaints.map((complaint) => ({
        ...complaint,
        _id: complaint._id.toString(),
      })),
    })
  } catch (error) {
    console.error("Error fetching complaints:", error)
    
    if (error instanceof Error && error.message.includes("connection failed")) {
      return NextResponse.json({ 
        error: "Database connection failed. Please try again later." 
      }, { status: 503 })
    }
    
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== "user") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { complaintType, area, description, contact } = await request.json()

    if (!complaintType || !area || !description || !contact) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 })
    }

    const client = await connectWithRetry()
    const db = client.db("dotslash")

    const result = await db.collection("complaints").insertOne({
      complaintType,
      area,
      description,
      contact,
      name: session.user.name,
      email: session.user.email,
      userId: session.user.id,
      status: "Pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    return NextResponse.json({
      success: true,
      message: "Complaint submitted successfully",
      complaintId: result.insertedId,
    })
  } catch (error) {
    console.error("Error creating complaint:", error)
    
    if (error instanceof Error && error.message.includes("connection failed")) {
      return NextResponse.json({ 
        error: "Database connection failed. Please try again later." 
      }, { status: 503 })
    }
    
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}