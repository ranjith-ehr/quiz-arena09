import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { AvatarCropper } from "@/components/AvatarCropper";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

const Profile = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [croppedAvatarBlob, setCroppedAvatarBlob] = useState<Blob | null>(null);
  
  // Cropper state
  const [cropperOpen, setCropperOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth?redirect=/profile");
        return;
      }
      
      setUser(session.user);
      setEmail(session.user.email || "");
      await loadProfile(session.user.id);
    } catch (error) {
      console.error("Error checking auth:", error);
      navigate("/auth");
    } finally {
      setLoading(false);
    }
  };

  const loadProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setProfile(data);
        setFullName(data.full_name || "");
        setAvatarPreview(data.avatar_url || null);
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file");
        return;
      }
      
      // Read and open cropper
      const reader = new FileReader();
      reader.onload = (event) => {
        setImageToCrop(event.target?.result as string);
        setCropperOpen(true);
      };
      reader.readAsDataURL(file);
    }
    // Reset input to allow re-selecting the same file
    e.target.value = "";
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    setCropperOpen(false);
    setImageToCrop(null);
    
    // Check if compressed image is still over 2MB, compress further if needed
    let finalBlob = croppedBlob;
    if (croppedBlob.size > MAX_FILE_SIZE) {
      finalBlob = await compressBlob(croppedBlob);
      toast.info("Image compressed to fit size limit");
    }
    
    setCroppedAvatarBlob(finalBlob);
    setAvatarPreview(URL.createObjectURL(finalBlob));
  };

  const compressBlob = async (blob: Blob): Promise<Blob> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxSize = 256; // Smaller size for better compression
        canvas.width = maxSize;
        canvas.height = maxSize;
        
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, maxSize, maxSize);
        }
        
        canvas.toBlob(
          (compressedBlob) => resolve(compressedBlob || blob),
          "image/jpeg",
          0.7
        );
      };
      img.src = URL.createObjectURL(blob);
    });
  };

  const uploadAvatar = async (): Promise<string | null> => {
    if (!croppedAvatarBlob || !user) return null;

    setUploading(true);
    try {
      // Delete old avatar if exists
      if (profile?.avatar_url) {
        try {
          const urlParts = profile.avatar_url.split("/avatars/");
          if (urlParts[1]) {
            await supabase.storage.from("avatars").remove([urlParts[1]]);
          }
        } catch (deleteError) {
          console.log("Could not delete old avatar:", deleteError);
        }
      }

      // Upload new avatar
      const fileName = `${user.id}/${Date.now()}.jpg`;
      
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, croppedAvatarBlob, {
          contentType: "image/jpeg",
          upsert: true
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error: any) {
      console.error("Failed to upload avatar:", error);
      toast.error("Failed to upload avatar: " + error.message);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate name
    try {
      z.string().min(1, "Name is required").max(100, "Name must be less than 100 characters").parse(fullName);
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.errors.forEach((err) => toast.error(err.message));
        return;
      }
    }

    setUpdating(true);
    try {
      let avatarUrl = profile?.avatar_url || null;

      // Upload avatar if changed
      if (croppedAvatarBlob) {
        const uploadedUrl = await uploadAvatar();
        if (uploadedUrl) {
          avatarUrl = uploadedUrl;
        } else if (croppedAvatarBlob) {
          // Upload failed but we had a new avatar
          toast.error("Avatar upload failed, but continuing with other changes");
        }
      }

      // Upsert profile
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          full_name: fullName,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'id'
        });
      
      if (profileError) {
        console.error("Profile update error:", profileError);
        throw profileError;
      }

      toast.success("Profile updated successfully!");
      
      // Reload profile to get fresh data
      await loadProfile(user.id);
      setCroppedAvatarBlob(null);
      
      // Dispatch event to refresh profile in Navbar and other components
      window.dispatchEvent(new CustomEvent('profile-updated'));
    } catch (error: any) {
      console.error("Failed to update profile:", error);
      toast.error("Failed to update profile: " + error.message);
    } finally {
      setUpdating(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) {
      toast.error("No email found");
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/auth?type=recovery`,
      });

      if (error) throw error;
      toast.success("Password reset link sent to your email!");
    } catch (error: any) {
      toast.error("Failed to send reset link: " + error.message);
    }
  };

  const getUserInitials = () => {
    if (fullName) {
      return fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    if (email) {
      return email[0].toUpperCase();
    }
    return "U";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-80px)]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Profile Settings</CardTitle>
            <CardDescription>Update your personal information and avatar</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateProfile} className="space-y-6">
              {/* Avatar Section */}
              <div className="flex flex-col items-center gap-4">
                <Avatar className="h-32 w-32">
                  <AvatarImage 
                    src={avatarPreview || undefined} 
                    alt={fullName || "User avatar"} 
                  />
                  <AvatarFallback className="text-3xl">{getUserInitials()}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-center gap-2">
                  <Label htmlFor="avatar" className="cursor-pointer">
                    <div className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors">
                      <Upload className="w-4 h-4" />
                      <span>Upload Avatar</span>
                    </div>
                  </Label>
                  <Input
                    id="avatar"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                  <p className="text-xs text-muted-foreground">
                    Max size: 2MB. Image will be cropped to a circle.
                  </p>
                </div>
              </div>

              {/* Name Field */}
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              {/* Email Field (Read-only) */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  disabled
                  className="bg-muted cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed. Contact support if needed.
                </p>
              </div>

              {/* Password Reset */}
              <div className="space-y-2">
                <Label>Password</Label>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePasswordReset}
                  className="w-full"
                >
                  Send Password Reset Link
                </Button>
                <p className="text-xs text-muted-foreground">
                  Reset link will be sent to your registered email
                </p>
              </div>

              {/* Submit Button */}
              <div className="flex gap-3">
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={updating || uploading}
                >
                  {updating || uploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {uploading ? "Uploading..." : "Saving..."}
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/quizzes")}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>

      {/* Avatar Cropper Modal */}
      {imageToCrop && (
        <AvatarCropper
          open={cropperOpen}
          onClose={() => {
            setCropperOpen(false);
            setImageToCrop(null);
          }}
          imageSrc={imageToCrop}
          onCropComplete={handleCropComplete}
        />
      )}
    </div>
  );
};

export default Profile;
