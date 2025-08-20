import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import axios from "axios";
import "./App.css";

// Import UI components
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Badge } from "./components/ui/badge";
import { Calendar } from "./components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./components/ui/dialog";
import { toast } from "./hooks/use-toast";
import { Toaster } from "./components/ui/toaster";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/ui/select";
import { Label } from "./components/ui/label";
import { Textarea } from "./components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "./components/ui/alert-dialog";

// Icons
import { 
  MapPin, Clock, Users, Star, CreditCard, User, Bus, CalendarDays, Search, 
  CheckCircle, X, Download, XCircle, RotateCcw, Plus, Edit, Trash2, 
  BarChart3, TrendingUp, DollarSign, UserCheck, Settings, LogOut,
  Eye, RotateCcw as Cancel, Shield
} from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = React.createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchProfile = async () => {
    try {
      const response = await axios.get(`${API}/profile`);
      setUser(response.data);
    } catch (error) {
      localStorage.removeItem('token');
      setToken(null);
      delete axios.defaults.headers.common['Authorization'];
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const response = await axios.post(`${API}/login`, { email, password });
    const { token: newToken, user: userData } = response.data;
    
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(userData);
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    
    return response.data;
  };

  const register = async (userData) => {
    const response = await axios.post(`${API}/register`, userData);
    const { token: newToken, user: newUser } = response.data;
    
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(newUser);
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    
    return response.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Header Component
const Header = () => {
  const { user, logout } = useAuth();
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const navigate = useNavigate();

  return (
    <header className="bg-white shadow-sm border-b sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-2 cursor-pointer" onClick={() => navigate('/')}>
            <Bus className="h-8 w-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900 font-['Montserrat']">BusBook</h1>
          </div>
          
          <nav className="hidden md:flex items-center space-x-6">
            <button 
              onClick={() => navigate('/')}
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              Home
            </button>
            {user && (
              <button 
                onClick={() => navigate('/bookings')}
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                My Bookings
              </button>
            )}
            {user?.role === 'admin' && (
              <button 
                onClick={() => navigate('/admin')}
                className="text-blue-600 hover:text-blue-800 transition-colors flex items-center space-x-1"
              >
                <Shield className="h-4 w-4" />
                <span>Admin Panel</span>
              </button>
            )}
          </nav>
          
          <div className="flex items-center space-x-4">
            {user ? (
              <div className="flex items-center space-x-3">
                <span className="text-sm text-gray-700">Welcome, {user.full_name}</span>
                <Button variant="outline" onClick={logout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              </div>
            ) : (
              <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
                <DialogTrigger asChild>
                  <Button>Login / Register</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Welcome to BusBook</DialogTitle>
                    <DialogDescription>
                      Login or create an account to book your bus tickets
                    </DialogDescription>
                  </DialogHeader>
                  <AuthTabs onClose={() => setShowAuthDialog(false)} />
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

// Auth Components
const AuthTabs = ({ onClose }) => {
  const { login, register } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('login');

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    const formData = new FormData(e.target);
    
    try {
      await login(formData.get('email'), formData.get('password'));
      toast({ title: "Login successful!" });
      onClose();
    } catch (error) {
      toast({ 
        title: "Login failed", 
        description: error.response?.data?.detail || "Invalid credentials",
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    const formData = new FormData(e.target);
    
    try {
      await register({
        email: formData.get('email'),
        password: formData.get('password'),
        full_name: formData.get('full_name'),
        phone: formData.get('phone')
      });
      toast({ title: "Registration successful!" });
      onClose();
    } catch (error) {
      toast({ 
        title: "Registration failed", 
        description: error.response?.data?.detail || "Something went wrong",
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">Login</TabsTrigger>
          <TabsTrigger value="register">Register</TabsTrigger>
        </TabsList>
        
        <TabsContent value="login" className="mt-4">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <Input 
                id="login-email"
                name="email" 
                type="email" 
                placeholder="Enter your email"
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">Password</Label>
              <Input 
                id="login-password"
                name="password" 
                type="password" 
                placeholder="Enter your password"
                required 
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Logging in..." : "Login"}
            </Button>
          </form>
        </TabsContent>
        
        <TabsContent value="register" className="mt-4">
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="register-name">Full Name</Label>
              <Input 
                id="register-name"
                name="full_name" 
                placeholder="Enter your full name"
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-email">Email</Label>
              <Input 
                id="register-email"
                name="email" 
                type="email" 
                placeholder="Enter your email"
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-phone">Phone</Label>
              <Input 
                id="register-phone"
                name="phone" 
                placeholder="Enter your phone number"
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-password">Password</Label>
              <Input 
                id="register-password"
                name="password" 
                type="password" 
                placeholder="Create a password"
                required 
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Creating account..." : "Register"}
            </Button>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Enhanced My Bookings Component
const MyBookings = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchBookings();
  }, [filter, page]);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString() });
      if (filter !== 'all') params.append('status', filter);
      
      const response = await axios.get(`${API}/my-bookings?${params}`);
      setBookings(response.data.bookings);
      setTotalPages(response.data.total_pages);
    } catch (error) {
      toast({ 
        title: "Failed to fetch bookings", 
        description: error.response?.data?.detail,
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = async (bookingId) => {
    try {
      const response = await axios.post(`${API}/cancel-booking/${bookingId}`);
      toast({ 
        title: "Booking cancelled successfully", 
        description: `Refund amount: ₹${response.data.refund_amount}` 
      });
      fetchBookings();
    } catch (error) {
      toast({ 
        title: "Cancellation failed", 
        description: error.response?.data?.detail,
        variant: "destructive" 
      });
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading your bookings...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h2 className="text-3xl font-bold mb-4">My Bookings</h2>
        
        {/* Filter Tabs */}
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList>
            <TabsTrigger value="all">All Bookings</TabsTrigger>
            <TabsTrigger value="confirmed">Confirmed</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {!bookings.length ? (
        <div className="text-center py-12">
          <Bus className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No bookings found for the selected filter.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {bookings.map((booking) => (
            <BookingCard 
              key={booking.id} 
              booking={booking} 
              onCancel={handleCancelBooking}
            />
          ))}
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center space-x-2 mt-8">
              <Button 
                variant="outline" 
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="flex items-center px-4">
                Page {page} of {totalPages}
              </span>
              <Button 
                variant="outline" 
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Enhanced Booking Card Component
const BookingCard = ({ booking, onCancel }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const canCancel = booking.status === 'confirmed' && booking.can_cancel;

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-semibold">{booking.operator?.name}</h3>
            <p className="text-gray-600">{booking.bus?.bus_number} • {booking.bus?.bus_type}</p>
          </div>
          <div className="text-right">
            <Badge className={getStatusColor(booking.status)}>
              {booking.status.toUpperCase()}
            </Badge>
            <p className="text-sm text-gray-500 mt-1">
              Booking ID: {booking.id.slice(-8)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <p className="text-sm text-gray-500">Route</p>
            <p className="font-medium">
              {booking.route?.origin} → {booking.route?.destination}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Journey Date & Time</p>
            <p className="font-medium">
              {formatDate(booking.schedule?.date)} at {booking.schedule?.departure_time}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Seats</p>
            <p className="font-medium">
              {booking.seats?.map(s => s.seat_number).join(', ')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-sm text-gray-500">Passengers</p>
            <div className="space-y-1">
              {booking.passenger_details?.map((passenger, index) => (
                <p key={index} className="text-sm">
                  {passenger.name} ({passenger.age}Y, {passenger.gender})
                </p>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-500">Booking Details</p>
            <p className="text-sm font-medium">Amount: ₹{booking.total_amount}</p>
            <p className="text-sm">Booked on: {formatDate(booking.booking_date)}</p>
            {booking.status === 'cancelled' && booking.refund_amount && (
              <p className="text-sm text-green-600">
                Refund: ₹{booking.refund_amount}
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <div className="flex space-x-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Ticket
            </Button>
          </div>
          
          {canCancel && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel Booking
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel Booking</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to cancel this booking? You will receive 90% refund of the total amount.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep Booking</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => onCancel(booking.id)}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Cancel Booking
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Search Component (Enhanced)
const BusSearch = ({ onSearch }) => {
  const [formData, setFormData] = useState({
    origin: '',
    destination: '',
    date: new Date()
  });
  const [showCalendar, setShowCalendar] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.origin || !formData.destination) {
      toast({ 
        title: "Please select both origin and destination cities",
        variant: "destructive" 
      });
      return;
    }
    onSearch(formData);
  };

  const cities = [
    "Mumbai", "Delhi", "Bangalore", "Chennai", "Kolkata", "Hyderabad",
    "Pune", "Ahmedabad", "Jaipur", "Surat", "Lucknow", "Kanpur"
  ];

  return (
    <Card className="w-full max-w-4xl mx-auto mb-8">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Search className="h-5 w-5" />
          <span>Search Buses</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="origin">From</Label>
            <Select onValueChange={(value) => setFormData(prev => ({ ...prev, origin: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select origin city" />
              </SelectTrigger>
              <SelectContent>
                {cities.map((city) => (
                  <SelectItem key={city} value={city}>{city}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="destination">To</Label>
            <Select onValueChange={(value) => setFormData(prev => ({ ...prev, destination: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select destination city" />
              </SelectTrigger>
              <SelectContent>
                {cities.map((city) => (
                  <SelectItem key={city} value={city}>{city}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Dialog open={showCalendar} onOpenChange={setShowCalendar}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  <CalendarDays className="h-4 w-4 mr-2" />
                  {formData.date ? formData.date.toDateString() : "Select date"}
                </Button>
              </DialogTrigger>
              <DialogContent className="p-0 w-auto">
                <Calendar
                  mode="single"
                  selected={formData.date}
                  onSelect={(date) => {
                    setFormData(prev => ({ ...prev, date }));
                    setShowCalendar(false);
                  }}
                  disabled={(date) => date < new Date(new Date().toDateString())}
                  initialFocus
                />
              </DialogContent>
            </Dialog>
          </div>
          
          <div className="flex items-end">
            <Button type="submit" className="w-full">
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

// Bus Results Component (same as before but using the enhanced search)
const BusResults = ({ buses, onSelectBus }) => {
  if (!buses || buses.length === 0) {
    return (
      <div className="text-center py-12">
        <Bus className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">No buses found for this route and date.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {buses.map((bus) => (
        <Card key={bus.schedule_id} className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-center">
              <div>
                <h3 className="font-semibold text-lg">{bus.operator_name}</h3>
                <p className="text-sm text-gray-600">{bus.bus_number} • {bus.bus_type}</p>
                <div className="flex items-center mt-1">
                  <Star className="h-4 w-4 text-yellow-400 fill-current" />
                  <span className="text-sm ml-1">{bus.operator_rating}</span>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="text-center">
                  <p className="font-semibold">{bus.departure_time}</p>
                  <p className="text-sm text-gray-600">Departure</p>
                </div>
                <div className="flex-1 border-t border-dashed border-gray-300 relative">
                  <span className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white px-2 text-xs text-gray-500">
                    {bus.duration}h
                  </span>
                </div>
                <div className="text-center">
                  <p className="font-semibold">{bus.arrival_time}</p>
                  <p className="text-sm text-gray-600">Arrival</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1">
                  {bus.amenities.slice(0, 3).map((amenity) => (
                    <Badge key={amenity} variant="secondary" className="text-xs">{amenity}</Badge>
                  ))}
                  {bus.amenities.length > 3 && (
                    <Badge variant="outline" className="text-xs">+{bus.amenities.length - 3}</Badge>
                  )}
                </div>
                <p className="text-sm text-gray-600 flex items-center">
                  <Users className="h-4 w-4 mr-1" />
                  {bus.available_seats} seats available
                </p>
              </div>
              
              <div className="text-right">
                <p className="text-2xl font-bold text-green-600">₹{bus.price}</p>
                <Button onClick={() => onSelectBus(bus)} className="mt-2">
                  Select Seats
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

// Keep the same SeatSelection, BookingSuccess, and HeroSection components as before
// (They remain unchanged from the previous implementation)

// Admin Panel Components
const AdminPanel = () => {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Admin Panel</h1>
        <p className="text-gray-600">Manage your bus booking system</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
          <TabsTrigger value="operators">Operators</TabsTrigger>
          <TabsTrigger value="routes">Routes</TabsTrigger>
          <TabsTrigger value="buses">Buses</TabsTrigger>
          <TabsTrigger value="schedules">Schedules</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <AdminDashboard />
        </TabsContent>
        
        <TabsContent value="bookings">
          <AdminBookings />
        </TabsContent>
        
        <TabsContent value="operators">
          <AdminOperators />
        </TabsContent>
        
        <TabsContent value="routes">
          <AdminRoutes />
        </TabsContent>
        
        <TabsContent value="buses">
          <AdminBuses />
        </TabsContent>
        
        <TabsContent value="schedules">
          <AdminSchedules />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Admin Dashboard with Statistics
const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/admin/stats`);
      setStats(response.data);
    } catch (error) {
      toast({ 
        title: "Failed to fetch statistics", 
        description: error.response?.data?.detail,
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading dashboard...</div>;
  }

  if (!stats) {
    return <div className="text-center py-12">Failed to load statistics</div>;
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_bookings}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{stats.total_revenue.toLocaleString()}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active_users}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Growth</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">+12%</div>
          </CardContent>
        </Card>
      </div>

      {/* Popular Routes */}
      <Card>
        <CardHeader>
          <CardTitle>Popular Routes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.popular_routes.map((route, index) => (
              <div key={index} className="flex justify-between items-center">
                <span>{route._id.origin} → {route._id.destination}</span>
                <div className="text-right">
                  <div className="font-semibold">{route.bookings} bookings</div>
                  <div className="text-sm text-gray-600">₹{route.revenue.toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Operator Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Top Performing Operators</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.operator_performance.map((operator, index) => (
              <div key={index} className="flex justify-between items-center">
                <span>{operator.name}</span>
                <div className="text-right">
                  <div className="font-semibold">{operator.bookings} bookings</div>
                  <div className="text-sm text-gray-600">₹{operator.revenue.toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Admin Bookings Management
const AdminBookings = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchBookings();
  }, [filter, page]);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString() });
      if (filter !== 'all') params.append('status', filter);
      
      const response = await axios.get(`${API}/admin/bookings?${params}`);
      setBookings(response.data.bookings);
      setTotalPages(response.data.total_pages);
    } catch (error) {
      toast({ 
        title: "Failed to fetch bookings", 
        description: error.response?.data?.detail,
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = async (bookingId) => {
    try {
      const response = await axios.post(`${API}/admin/cancel-booking/${bookingId}`);
      toast({ 
        title: "Booking cancelled successfully", 
        description: `Refund amount: ₹${response.data.refund_amount}` 
      });
      fetchBookings();
    } catch (error) {
      toast({ 
        title: "Cancellation failed", 
        description: error.response?.data?.detail,
        variant: "destructive" 
      });
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading bookings...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">All Bookings</h2>
        
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="confirmed">Confirmed</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Booking ID</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Seats</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((booking) => (
                <TableRow key={booking.id}>
                  <TableCell className="font-mono text-sm">
                    {booking.id.slice(-8)}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{booking.user?.full_name}</div>
                      <div className="text-sm text-gray-600">{booking.user?.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {booking.route?.origin} → {booking.route?.destination}
                  </TableCell>
                  <TableCell>
                    {new Date(booking.schedule?.date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {booking.seats?.map(s => s.seat_number).join(', ')}
                  </TableCell>
                  <TableCell>₹{booking.total_amount}</TableCell>
                  <TableCell>
                    <Badge className={
                      booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                      booking.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                      'bg-blue-100 text-blue-800'
                    }>
                      {booking.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {booking.status === 'confirmed' && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Cancel Booking</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to cancel this booking? The user will receive a full refund.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Keep Booking</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleCancelBooking(booking.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Cancel Booking
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center space-x-2">
          <Button 
            variant="outline" 
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="flex items-center px-4">
            Page {page} of {totalPages}
          </span>
          <Button 
            variant="outline" 
            onClick={() => setPage(page + 1)}
            disabled={page === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
};

// Admin Operators Management
const AdminOperators = () => {
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  useEffect(() => {
    fetchOperators();
  }, []);

  const fetchOperators = async () => {
    try {
      const response = await axios.get(`${API}/admin/operators`);
      setOperators(response.data);
    } catch (error) {
      toast({ 
        title: "Failed to fetch operators", 
        description: error.response?.data?.detail,
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOperator = async (formData) => {
    try {
      await axios.post(`${API}/admin/operators`, {
        name: formData.get('name'),
        contact_email: formData.get('contact_email'),
        contact_phone: formData.get('contact_phone')
      });
      toast({ title: "Operator created successfully" });
      setShowCreateDialog(false);
      fetchOperators();
    } catch (error) {
      toast({ 
        title: "Failed to create operator", 
        description: error.response?.data?.detail,
        variant: "destructive" 
      });
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading operators...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Bus Operators</h2>
        
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Operator
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Operator</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              handleCreateOperator(new FormData(e.target));
            }} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Operator Name</Label>
                <Input name="name" required placeholder="Enter operator name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_email">Contact Email</Label>
                <Input name="contact_email" type="email" required placeholder="Enter contact email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_phone">Contact Phone</Label>
                <Input name="contact_phone" required placeholder="Enter contact phone" />
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Operator</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {operators.map((operator) => (
          <Card key={operator.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {operator.name}
                <div className="flex items-center">
                  <Star className="h-4 w-4 text-yellow-400 fill-current mr-1" />
                  <span className="text-sm">{operator.rating}</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <p><strong>Email:</strong> {operator.contact_email}</p>
                <p><strong>Phone:</strong> {operator.contact_phone}</p>
                <p><strong>Created:</strong> {new Date(operator.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex justify-end space-x-2 mt-4">
                <Button variant="outline" size="sm">
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

// Similar components for AdminRoutes, AdminBuses, AdminSchedules would follow the same pattern
// For brevity, I'll create simplified versions

const AdminRoutes = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Routes Management</h2>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Route
        </Button>
      </div>
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-gray-500">Routes management interface will be implemented here.</p>
        </CardContent>
      </Card>
    </div>
  );
};

const AdminBuses = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Bus Fleet Management</h2>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Bus
        </Button>
      </div>
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-gray-500">Bus management interface will be implemented here.</p>
        </CardContent>
      </Card>
    </div>
  );
};

const AdminSchedules = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Schedule Management</h2>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Schedule
        </Button>
      </div>
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-gray-500">Schedule management interface will be implemented here.</p>
        </CardContent>
      </Card>
    </div>
  );
};

// Keep existing components (SeatSelection, BookingSuccess, HeroSection, HomePage) exactly as before
// For brevity, I'll reference them but not duplicate the code

// Seat Selection Component (same as before)
const SeatSelection = ({ bus, seats, onBookingComplete }) => {
  const { user } = useAuth();
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [passengerDetails, setPassengerDetails] = useState([]);
  const [currentStep, setCurrentStep] = useState('seats');
  const [isLoading, setIsLoading] = useState(false);

  const handleSeatClick = (seat) => {
    if (seat.is_booked) return;
    
    const isSelected = selectedSeats.includes(seat.seat_number);
    let newSelectedSeats;
    
    if (isSelected) {
      newSelectedSeats = selectedSeats.filter(s => s !== seat.seat_number);
    } else {
      if (selectedSeats.length >= 6) {
        toast({ 
          title: "Maximum 6 seats can be selected",
          variant: "destructive" 
        });
        return;
      }
      newSelectedSeats = [...selectedSeats, seat.seat_number];
    }
    
    setSelectedSeats(newSelectedSeats);
    
    const newPassengerDetails = newSelectedSeats.map((seatNum, index) => 
      passengerDetails[index] || { name: '', age: '', gender: 'male' }
    );
    setPassengerDetails(newPassengerDetails);
  };

  const handlePassengerDetailChange = (index, field, value) => {
    const updated = [...passengerDetails];
    updated[index] = { ...updated[index], [field]: value };
    setPassengerDetails(updated);
  };

  const handleBooking = async () => {
    if (!user) {
      toast({ title: "Please login to book tickets", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post(`${API}/book-tickets`, {
        schedule_id: bus.schedule_id,
        seats: selectedSeats,
        passenger_details: passengerDetails
      });
      
      toast({ title: "Booking confirmed successfully!" });
      onBookingComplete(response.data.booking);
    } catch (error) {
      toast({ 
        title: "Booking failed", 
        description: error.response?.data?.detail || "Something went wrong",
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getSeatColor = (seat) => {
    if (seat.is_booked) return 'bg-red-500 text-white cursor-not-allowed';
    if (selectedSeats.includes(seat.seat_number)) return 'bg-green-500 text-white';
    return 'bg-gray-200 hover:bg-gray-300 cursor-pointer';
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>{bus.operator_name}</CardTitle>
              <CardDescription>{bus.bus_number} • {bus.bus_type}</CardDescription>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">₹{bus.price}</p>
              <p className="text-sm text-gray-600">per seat</p>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <Tabs value={currentStep} onValueChange={setCurrentStep}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="seats" disabled={selectedSeats.length === 0 && currentStep !== 'seats'}>
                Select Seats ({selectedSeats.length})
              </TabsTrigger>
              <TabsTrigger value="passengers" disabled={selectedSeats.length === 0}>
                Passenger Details
              </TabsTrigger>
              <TabsTrigger value="payment" disabled={selectedSeats.length === 0 || passengerDetails.some(p => !p.name || !p.age)}>
                Payment
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="seats" className="space-y-6">
              <div className="flex justify-center space-x-8 text-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-gray-200 rounded"></div>
                  <span>Available</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-green-500 rounded"></div>
                  <span>Selected</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-red-500 rounded"></div>
                  <span>Booked</span>
                </div>
              </div>
              
              <div className="bg-gray-50 p-6 rounded-lg">
                <div className="text-center mb-4">
                  <div className="w-16 h-8 bg-gray-800 rounded-t-lg mx-auto"></div>
                  <p className="text-xs text-gray-600 mt-1">Driver</p>
                </div>
                
                <div className="grid grid-cols-4 gap-3 max-w-md mx-auto">
                  {seats.map((seat) => (
                    <button
                      key={seat.seat_number}
                      onClick={() => handleSeatClick(seat)}
                      className={`w-12 h-12 rounded text-sm font-medium transition-colors ${getSeatColor(seat)}`}
                      disabled={seat.is_booked}
                    >
                      {seat.seat_number}
                    </button>
                  ))}
                </div>
              </div>
              
              {selectedSeats.length > 0 && (
                <div className="text-center">
                  <p className="text-lg">
                    Selected Seats: <strong>{selectedSeats.join(', ')}</strong>
                  </p>
                  <p className="text-xl font-bold text-green-600">
                    Total: ₹{selectedSeats.length * bus.price}
                  </p>
                  <Button onClick={() => setCurrentStep('passengers')} className="mt-4">
                    Continue to Passenger Details
                  </Button>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="passengers" className="space-y-4">
              {selectedSeats.map((seatNum, index) => (
                <Card key={seatNum}>
                  <CardHeader>
                    <CardTitle className="text-lg">Passenger {index + 1} - Seat {seatNum}</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`name-${index}`}>Full Name</Label>
                      <Input
                        id={`name-${index}`}
                        value={passengerDetails[index]?.name || ''}
                        onChange={(e) => handlePassengerDetailChange(index, 'name', e.target.value)}
                        placeholder="Enter full name"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`age-${index}`}>Age</Label>
                      <Input
                        id={`age-${index}`}
                        type="number"
                        value={passengerDetails[index]?.age || ''}
                        onChange={(e) => handlePassengerDetailChange(index, 'age', e.target.value)}
                        placeholder="Enter age"
                        min="1"
                        max="100"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`gender-${index}`}>Gender</Label>
                      <Select 
                        value={passengerDetails[index]?.gender || 'male'}
                        onValueChange={(value) => handlePassengerDetailChange(index, 'gender', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              <div className="text-center">
                <Button 
                  onClick={() => setCurrentStep('payment')}
                  disabled={passengerDetails.some(p => !p.name || !p.age)}
                >
                  Continue to Payment
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="payment" className="space-y-6">
              <div className="bg-blue-50 p-6 rounded-lg">
                <h3 className="text-lg font-semibold mb-4">Booking Summary</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Route:</span>
                    <span>{bus.origin} → {bus.destination}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Date & Time:</span>
                    <span>{bus.date} at {bus.departure_time}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Seats:</span>
                    <span>{selectedSeats.join(', ')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Passengers:</span>
                    <span>{selectedSeats.length}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-semibold text-lg">
                    <span>Total Amount:</span>
                    <span>₹{selectedSeats.length * bus.price}</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-yellow-50 p-4 rounded-lg">
                <div className="flex items-center space-x-2">
                  <CreditCard className="h-5 w-5 text-yellow-600" />
                  <span className="text-yellow-800 font-medium">Dummy Payment System</span>
                </div>
                <p className="text-yellow-700 text-sm mt-1">
                  This is a demo payment. No actual payment will be processed.
                </p>
              </div>
              
              <div className="text-center">
                <Button 
                  onClick={handleBooking}
                  disabled={isLoading}
                  size="lg"
                  className="w-full md:w-auto"
                >
                  {isLoading ? "Processing..." : `Pay ₹${selectedSeats.length * bus.price} & Confirm Booking`}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

// Booking Success Component (same as before)
const BookingSuccess = ({ booking }) => {
  return (
    <div className="max-w-2xl mx-auto text-center">
      <div className="bg-green-50 p-8 rounded-lg">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-green-800 mb-2">Booking Confirmed!</h2>
        <p className="text-green-700 mb-4">Your ticket has been booked successfully.</p>
        
        <div className="bg-white p-4 rounded border text-left">
          <h3 className="font-semibold mb-2">Booking Details</h3>
          <p><strong>Booking ID:</strong> {booking.id}</p>
          <p><strong>Seats:</strong> {booking.seats.map(s => s.seat_number).join(', ')}</p>
          <p><strong>Total Amount:</strong> ₹{booking.total_amount}</p>
          <p><strong>Status:</strong> {booking.status}</p>
        </div>
      </div>
    </div>
  );
};

// Hero Section (same as before)
const HeroSection = () => {
  return (
    <div className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 text-white py-24 overflow-hidden">
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: 'url(https://images.unsplash.com/photo-1498084393753-b411b2d26b34?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzB8MHwxfHNlYXJjaHwxfHx0cmFuc3BvcnRhdGlvbnxlbnwwfHx8fDE3NTU2NzEzNDN8MA&ixlib=rb-4.1.0&q=85)',
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="text-5xl md:text-6xl font-bold font-['Montserrat'] mb-6">
          Book Your Journey
        </h1>
        <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto font-light">
          Find and book bus tickets across India with ease. Comfortable seats, reliable operators, and unbeatable prices.
        </p>
        <div className="flex flex-wrap justify-center gap-8 text-center">
          <div className="flex items-center space-x-2">
            <Bus className="h-8 w-8" />
            <span className="text-lg">500+ Routes</span>
          </div>
          <div className="flex items-center space-x-2">
            <Users className="h-8 w-8" />
            <span className="text-lg">50+ Operators</span>
          </div>
          <div className="flex items-center space-x-2">
            <Star className="h-8 w-8" />
            <span className="text-lg">Trusted Service</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main HomePage Component (enhanced)
const HomePage = () => {
  const [searchResults, setSearchResults] = useState(null);
  const [selectedBus, setSelectedBus] = useState(null);
  const [seats, setSeats] = useState([]);
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const handleSearch = async (searchData) => {
    setLoading(true);
    try {
      const response = await axios.post(`${API}/search-buses`, {
        origin: searchData.origin,
        destination: searchData.destination,
        date: searchData.date.toISOString().split('T')[0]
      });
      setSearchResults(response.data.buses);
      setSelectedBus(null);
      setBooking(null);
    } catch (error) {
      toast({ 
        title: "Search failed", 
        description: error.response?.data?.detail || "Something went wrong",
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBus = async (bus) => {
    if (!user) {
      toast({ title: "Please login to select seats", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get(`${API}/bus-seats/${bus.schedule_id}`);
      setSeats(response.data.seats);
      setSelectedBus(bus);
    } catch (error) {
      toast({ 
        title: "Failed to load seats", 
        description: error.response?.data?.detail,
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBookingComplete = (bookingData) => {
    setBooking(bookingData);
    setSelectedBus(null);
    setSearchResults(null);
  };

  if (booking) {
    return (
      <div className="container mx-auto px-4 py-8">
        <BookingSuccess booking={booking} />
        <div className="text-center mt-8">
          <Button onClick={() => setBooking(null)}>
            Search More Buses
          </Button>
        </div>
      </div>
    );
  }

  if (selectedBus) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-4">
          <Button variant="outline" onClick={() => setSelectedBus(null)}>
            <X className="h-4 w-4 mr-2" />
            Back to Results
          </Button>
        </div>
        <SeatSelection 
          bus={selectedBus} 
          seats={seats} 
          onBookingComplete={handleBookingComplete}
        />
      </div>
    );
  }

  return (
    <div>
      <HeroSection />
      <div className="container mx-auto px-4 py-8">
        <BusSearch onSearch={handleSearch} />
        
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Searching buses...</p>
          </div>
        )}
        
        {searchResults && !loading && (
          <BusResults buses={searchResults} onSelectBus={handleSelectBus} />
        )}
      </div>
    </div>
  );
};

// Protected Route Component
const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
    </div>;
  }
  
  if (!user) {
    return <Navigate to="/" replace />;
  }
  
  if (adminOnly && user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  
  return children;
};

// Main App Content Component
const AppContent = () => {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="App min-h-screen bg-gray-50">
      <BrowserRouter>
        <Header />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/bookings" element={
            <ProtectedRoute>
              <MyBookings />
            </ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute adminOnly={true}>
              <AdminPanel />
            </ProtectedRoute>
          } />
        </Routes>
        <Toaster />
      </BrowserRouter>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;