import os
import smtplib
from email.message import EmailMessage
import logging
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

async def send_order_email(order: dict):
    """
    Asynchronously send an order confirmation email via Gmail SMTP.
    """
    email_username = os.environ.get('EMAIL_USERNAME')
    email_password = os.environ.get('EMAIL_PASSWORD')
    to_email = os.environ.get('NOTIFICATION_EMAIL', email_username) 
    
    if not email_username or not email_password:
        logger.warning("EMAIL_USERNAME or EMAIL_PASSWORD not set. Skipping email notification.")
        return

    try:
        # 1. Connect to DB to get user's email for the receipt
        mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
        db_name = os.environ.get('DB_NAME', 'lastgear')
        client = AsyncIOMotorClient(mongo_url)
        db = client[db_name]
        
        user = await db.users.find_one({"id": order.get('user_id')})
        customer_email = user.get('email') if user else ''
        
        # 2. Extract shared variables
        shipping = order.get('shipping_address', {})
        customer_name = shipping.get('full_name', 'Customer')
        customer_phone = shipping.get('phone', 'N/A')
        order_id = order.get('id', 'N/A')
        order_date = order.get('created_at', 'N/A')
        total_amount = f"₹{order.get('total_amount', 0.0):.2f}"
        
        payment_status_raw = order.get('payment_status', '').lower()
        if payment_status_raw == 'pending_cod':
            payment_text = 'Cash on Delivery (COD)'
            admin_payment_status = 'Unpaid'
        elif payment_status_raw == 'paid':
            payment_text = 'Online Payment (Prepaid)'
            admin_payment_status = 'Paid'
        else:
            payment_text = payment_status_raw.upper()
            admin_payment_status = payment_status_raw.upper()
            
        # Build Items List for HTML (Customer) & Plain Text (Admin)
        customer_items_html = ""
        admin_items_text = ""
        
        for item in order.get('items', []):
            item_name = item.get("name")
            item_size = item.get("size")
            item_color = item.get("color")
            item_qty = item.get("quantity")
            item_image = item.get('image')
            
            # Customer HTML List
            img_tag = f'<img src="{item_image}" alt="{item_name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px; margin-right: 15px; vertical-align: middle;">' if item_image else ''
            customer_items_html += f'<li style="margin-bottom: 10px; display: flex; align-items: center;">{img_tag}<span><strong>{item_name}</strong> - Size: {item_size} - Color: {item_color} (Qty: {item_qty})</span></li>'
            
            # Admin Text List
            admin_items_text += f"{item_name} (Size {item_size}, Color {item_color}) × {item_qty}<br>"

        shipping_address_text = f"{shipping.get('address_line1', '')}<br>"
        if shipping.get('address_line2'):
            shipping_address_text += f"{shipping.get('address_line2')}<br>"
        shipping_address_text += f"{shipping.get('city', '')}, {shipping.get('state', '')} {shipping.get('postal_code', '')}<br>{shipping.get('country', '')}"
        
        # ---------------------------------------------------------
        # 3. BUILD CUSTOMER EMAIL (HTML Receipt)
        # ---------------------------------------------------------
        if customer_email:
            customer_msg = EmailMessage()
            customer_msg['Subject'] = f"🚀 New Order Received! #{order_id}"
            customer_msg['From'] = email_username
            customer_msg['To'] = customer_email
            
            customer_html = f"""
            <html>
                <body style="font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <p style="font-size: 16px;">Hi <strong>{customer_name}</strong>,</p>
                    <p style="font-size: 16px;">Thank you for shopping with LAST GEAR! Your order has been successfully placed.</p>
                    
                    <h3 style="border-bottom: 2px solid #eee; padding-bottom: 10px; margin-top: 30px;">Order Details</h3>
                    <table style="width: 100%; margin-bottom: 20px;">
                        <tr><td style="padding: 4px 0;"><strong>Order ID:</strong></td><td>{order_id}</td></tr>
                        <tr><td style="padding: 4px 0;"><strong>Order Date:</strong></td><td>{order_date}</td></tr>
                        <tr><td style="padding: 4px 0;"><strong>Payment Method:</strong></td><td><strong>{payment_text}</strong></td></tr>
                    </table>
                    
                    <h3 style="border-bottom: 2px solid #eee; padding-bottom: 10px;">Items Ordered</h3>
                    <ul style="list-style-type: none; padding-left: 0;">
                        {customer_items_html}
                    </ul>
                    
                    <h3 style="border-bottom: 2px solid #eee; padding-bottom: 10px; margin-top: 30px;">Shipping Address</h3>
                    <p style="background-color: #f9f9f9; padding: 15px; border-radius: 5px;">
                        {shipping_address_text}
                    </p>
                    
                    <h3 style="border-bottom: 2px solid #eee; padding-bottom: 10px; margin-top: 30px;">Order Total</h3>
                    <p style="font-size: 24px; font-weight: bold; color: #000; margin-top: 10px;">{total_amount}</p>
                    
                    <hr style="border: 0; border-top: 1px solid #ddd; margin: 40px 0;">
                    
                    <h4 style="margin-bottom: 15px; font-size: 18px;">What happens next?</h4>
                    <ul style="padding-left: 20px; line-height: 1.8;">
                        <li>We are preparing your order for shipment</li>
                        <li>You will receive another email when your order is shipped</li>
                        <li>Delivery usually takes 3–7 business days</li>
                    </ul>
                    
                    <hr style="border: 0; border-top: 1px solid #ddd; margin: 40px 0;">
                    <p>If you have any questions, feel free to contact us.</p>
                    <p><strong>Email:</strong> support@lastgear.in</p>
                    <p style="margin-top: 30px;">Thank you for choosing LAST GEAR.</p>
                    <p style="font-style: italic; font-weight: bold; font-size: 18px;">Stay bold. Stay unstoppable. ⚡</p>
                    <p style="margin-top: 30px; font-weight: bold;">LAST GEAR Team</p>
                    <p><a href="https://lastgear.in" style="color: #000; text-decoration: none;">https://lastgear.in</a></p>
                </body>
            </html>
            """
            customer_msg.set_content("Please enable HTML viewing to see this email.")
            customer_msg.add_alternative(customer_html, subtype='html')

        # ---------------------------------------------------------
        # 4. BUILD ADMIN EMAIL (Notification)
        # ---------------------------------------------------------
        admin_msg = EmailMessage()
        admin_msg['Subject'] = f"🔔 NEW ORDER ALERT: #{order_id}"
        admin_msg['From'] = email_username
        admin_msg['To'] = to_email
        
        admin_html = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                <p>Hello,</p>
                <p>A new order has been placed on LAST GEAR.</p>
                
                <h3 style="border-bottom: 1px solid #ddd; padding-bottom: 5px;">Order Information</h3>
                <p>
                    <strong>Order ID:</strong> {order_id}<br>
                    <strong>Order Date:</strong> {order_date}<br>
                    <strong>Customer Name:</strong> {customer_name}<br>
                    <strong>Customer Email:</strong> {customer_email}<br>
                    <strong>Phone:</strong> {customer_phone}
                </p>
                
                <h3 style="border-bottom: 1px solid #ddd; padding-bottom: 5px;">Order Items</h3>
                <p>{admin_items_text}</p>
                
                <h3 style="border-bottom: 1px solid #ddd; padding-bottom: 5px;">Payment Information</h3>
                <p>
                    <strong>Payment Method:</strong> {payment_text}<br>
                    <strong>Payment Status:</strong> {"<span style='color: green;'>PAID</span>" if admin_payment_status == 'Paid' else "<span style='color: orange;'>UNPAID (COD)</span>"}<br>
                    <strong>Order Total:</strong> {total_amount}
                </p>
                
                <h3 style="border-bottom: 1px solid #ddd; padding-bottom: 5px;">Delivery Address</h3>
                <p style="background: #f4f4f4; padding: 10px;">{shipping_address_text}</p>
                
                <hr style="border: 0; border-top: 1px solid #ccc; margin: 30px 0;">
                <p>Please log in to the admin dashboard to process this order.</p>
                <p><strong>Admin Panel:</strong><br><a href="https://lastgear.in/admin">https://lastgear.in/admin</a></p>
                
                <p style="margin-top: 40px; font-size: 12px; color: #888;">LAST GEAR Notification System</p>
            </body>
        </html>
        """
        admin_msg.set_content("Please enable HTML viewing to see this email.")
        admin_msg.add_alternative(admin_html, subtype='html')

        # Run SMTP blocking operations in a thread pool to avoid blocking the asyncio event loop
        def send_email_sync():
            with smtplib.SMTP_SSL('smtp.gmail.com', 465) as smtp:
                smtp.login(email_username, email_password)
                
                # Send to admin
                smtp.send_message(admin_msg)
                
                # Send to customer natively if their email resolves correctly
                if customer_email:
                    smtp.send_message(customer_msg)

        await asyncio.to_thread(send_email_sync)
        logger.info(f"Dual order email notifications sent for Order ID: {order_id}")
        
    except Exception as e:
        logger.error(f"Failed to send dual order emails: {str(e)}")

async def send_order_status_email(order: dict):
    """
    Asynchronously send an order status update email to the customer.
    """
    email_username = os.environ.get('EMAIL_USERNAME')
    email_password = os.environ.get('EMAIL_PASSWORD')
    to_email = os.environ.get('NOTIFICATION_EMAIL', email_username) 
    
    if not email_username or not email_password:
        return

    try:
        order_id = order.get('id', 'N/A')
        new_status = order.get('order_status', '').upper()
        tracking_number = order.get('tracking_number')
        
        # Map status to emojis
        status_emojis = {
            'PROCESSING': '⚙️',
            'SHIPPED': '🚚',
            'DELIVERED': '🎉',
            'CANCELLED': '❌'
        }
        emoji = status_emojis.get(new_status, '📦')
        
        # Connect to DB to get user's email
        mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
        db_name = os.environ.get('DB_NAME', 'lastgear')
        client = AsyncIOMotorClient(mongo_url)
        db = client[db_name]
        
        user = await db.users.find_one({"id": order.get('user_id')})
        if not user or not user.get('email'):
            return  # Cannot send if no customer email
            
        customer_email = user.get('email')
        if customer_email == "admin@lastgear.in":
            return  # Block dummy domain to prevent bounces
        customer_name = order.get('shipping_address', {}).get('full_name', 'Customer')
        
        msg = EmailMessage()
        msg['Subject'] = f"{emoji} Order Status Update: #{order_id} is {new_status}"
        msg['From'] = email_username
        msg['To'] = customer_email
        
        tracking_html = f"<p><strong>Tracking Number:</strong> {tracking_number}</p>" if tracking_number else ""
        
        html_content = f"""
        <html>
            <body style="font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">
                <p style="font-size: 16px;">Hi <strong>{customer_name}</strong>,</p>
                <p style="font-size: 16px;">The status of your LAST GEAR order <strong>#{order_id}</strong> has been updated.</p>
                
                <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 30px 0;">
                    <p style="font-size: 18px; text-transform: uppercase;"><strong>Current Status: {emoji} {new_status}</strong></p>
                    {tracking_html}
                </div>
                
                <p>If you have any questions, feel free to contact us.</p>
                <p><strong>Email:</strong> support@lastgear.in</p>
                <p style="margin-top: 30px;">Thank you for choosing LAST GEAR.</p>
                <p style="font-style: italic; font-weight: bold; font-size: 18px;">Stay bold. Stay unstoppable. ⚡</p>
                <p style="margin-top: 30px; font-weight: bold;">LAST GEAR Team</p>
                <p><a href="https://lastgear.in" style="color: #000; text-decoration: none;">https://lastgear.in</a></p>
            </body>
        </html>
        """
        msg.set_content("Please enable HTML viewing to see this email.")
        msg.add_alternative(html_content, subtype='html')

        def send_email_sync():
            with smtplib.SMTP_SSL('smtp.gmail.com', 465) as smtp:
                smtp.login(email_username, email_password)
                smtp.send_message(msg)

        await asyncio.to_thread(send_email_sync)
        logger.info(f"Order status email sent to {customer_email} for Order ID: {order_id}")
        
    except Exception as e:
        logger.error(f"Failed to send order status email: {str(e)}")

async def send_order_cancellation_email(order: dict):
    """
    Asynchronously send order cancellation emails to admin and customer.
    """
    email_username = os.environ.get('EMAIL_USERNAME')
    email_password = os.environ.get('EMAIL_PASSWORD')
    to_email = "lastgearorders@gmail.com"
    
    if not email_username or not email_password:
        return

    try:
        # Connect to DB to get user's email
        mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
        db_name = os.environ.get('DB_NAME', 'lastgear')
        client = AsyncIOMotorClient(mongo_url)
        db = client[db_name]
        
        user = await db.users.find_one({"id": order.get('user_id')})
        customer_email = user.get('email') if user else ''
        
        # Block dummy admin email from receiving customer-side notifications to prevent SMTP bounces
        if customer_email == "admin@lastgear.in":
            customer_email = ""
        
        # Extract variables
        shipping = order.get('shipping_address', {})
        customer_name = shipping.get('full_name', 'Customer')
        order_id = order.get('id', 'N/A')
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        total_amount = f"₹{order.get('total_amount', 0.0):.2f}"
        
        payment_status_raw = order.get('payment_status', '').lower()
        if payment_status_raw == 'cancelled':
            payment_text = 'COD'
        elif payment_status_raw == 'refund_pending':
            payment_text = 'Prepaid'
        else:
            payment_text = payment_status_raw.upper()
            
        admin_items_text = ""
        for item in order.get('items', []):
            item_name = item.get("name")
            item_size = item.get("size")
            item_qty = item.get("quantity")
            admin_items_text += f"{item_name} (Size {item_size}) × {item_qty}\n"

        # 1. Admin Email
        admin_msg = EmailMessage()
        admin_msg['Subject'] = f"Order Cancelled – LAST GEAR (#{order_id})"
        admin_msg['From'] = email_username
        admin_msg['To'] = to_email
        
        admin_text = f"A cancellation request has been approved by admin.\n\n"
        admin_text += f"Order ID: {order_id}\n"
        admin_text += f"Customer: {customer_name}\n"
        admin_text += f"Payment Method: {payment_text}\n"
        admin_text += f"Total Amount: {total_amount}\n\n"
        admin_text += f"Products:\n{admin_items_text.strip()}\n\n"
        admin_text += f"Status:\nOrder Cancelled\n\n"
        admin_text += f"Time:\n{timestamp}\n"
        
        admin_msg.set_content(admin_text)

        # 2. Customer Email
        customer_msg = None
        if customer_email:
            customer_msg = EmailMessage()
            customer_msg['Subject'] = f"❌ Order Cancelled: #{order_id}"
            customer_msg['From'] = email_username
            customer_msg['To'] = customer_email
            
            customer_html = f"""
            <html>
                <body style="font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <p style="font-size: 16px;">Hi <strong>{customer_name}</strong>,</p>
                    <p style="font-size: 16px;">Your order <strong>#{order_id}</strong> has been cancelled successfully.</p>
                    
                    <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 30px 0;">
                        <p style="font-size: 18px; text-transform: uppercase;"><strong>Current Status: ❌ CANCELLED</strong></p>
                    </div>
                    
                    <p>If you requested a refund for a prepaid order, it will be processed shortly (usually within 5-7 business days).</p>
                    
                    <p>If you have any questions, feel free to contact us.</p>
                    <p><strong>Email:</strong> support@lastgear.in</p>
                    <p style="margin-top: 30px;">LAST GEAR Team</p>
                </body>
            </html>
            """
            # "Your order has been cancelled successfully" text version
            customer_msg.set_content("Your order has been cancelled successfully.")
            customer_msg.add_alternative(customer_html, subtype='html')

        def send_email_sync():
            with smtplib.SMTP_SSL('smtp.gmail.com', 465) as smtp:
                smtp.login(email_username, email_password)
                smtp.send_message(admin_msg)
                if customer_msg:
                    smtp.send_message(customer_msg)

        await asyncio.to_thread(send_email_sync)
        logger.info(f"Cancellation email sent successfully for Order ID: {order_id}")
        print("Cancellation email sent successfully")
        
    except Exception as e:
        logger.error(f"Failed to send order cancellation email: {str(e)}")
        print("Email failed:", str(e))

async def send_exchange_request_email(exchange: dict):
    """
    Alerts the admin that a new exchange request has been submitted.
    """
    email_username = os.environ.get('EMAIL_USERNAME')
    email_password = os.environ.get('EMAIL_PASSWORD')
    admin_email = "lastgearorders@gmail.com"
    
    if not email_username or not email_password:
        return

    try:
        msg = EmailMessage()
        msg['Subject'] = f"New Exchange Request - LAST GEAR (#{exchange.get('order_id')})"
        msg['From'] = email_username
        msg['To'] = admin_email
        
        request_id = exchange.get('request_id', 'N/A')
        order_id = exchange.get('order_id', 'N/A')
        customer_name = exchange.get('customer_name', 'N/A')
        email = exchange.get('customer_email', 'N/A')
        phone = exchange.get('phone_number', 'N/A')
        product = exchange.get('product_name', 'N/A')
        size_old = exchange.get('size_purchased', 'N/A')
        size_new = exchange.get('size_requested', 'N/A')
        reason = exchange.get('reason', 'N/A')
        image_url = exchange.get('image_url', 'None provided')
        
        text_content = f"""
EXCHANGE REQUEST #{request_id}
Order ID: {order_id}
Customer: {customer_name}
Email: {email}
Phone: {phone}

PRODUCT DETAILS:
Name: {product}
Size Purchased: {size_old}
Size Requested: {size_new}
Reason: {reason}
Defect Image: {image_url}

Please review this request in the LAST GEAR Admin Panel Exchange Hub.
"""
        msg.set_content(text_content)
        
        def send_email_sync():
            with smtplib.SMTP_SSL('smtp.gmail.com', 465) as smtp:
                smtp.login(email_username, email_password)
                smtp.send_message(msg)
                
        await asyncio.to_thread(send_email_sync)
        logger.info(f"Exchange request email sent for Request ID: {request_id}")
    except Exception as e:
        logger.error(f"Failed to send exchange request email: {str(e)}")

async def send_exchange_approved_email(exchange: dict):
    """
    Alerts the customer that their exchange request has been approved.
    """
    email_username = os.environ.get('EMAIL_USERNAME')
    email_password = os.environ.get('EMAIL_PASSWORD')
    customer_email = exchange.get('customer_email')
    
    if not email_username or not email_password or not customer_email:
        return

    try:
        msg = EmailMessage()
        msg['Subject'] = f"Exchange Request Approved - LAST GEAR (#{exchange.get('order_id')})"
        msg['From'] = email_username
        msg['To'] = customer_email
        
        customer_name = exchange.get('customer_name', 'Customer')
        product = exchange.get('product_name', 'N/A')
        size_new = exchange.get('size_requested', 'N/A')
        
        html_content = f"""
        <html>
            <body style="font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #ff003c; text-transform: uppercase;">Exchange Approved</h2>
                <p style="font-size: 16px;">Hi <strong>{customer_name}</strong>,</p>
                <p style="font-size: 16px;">Good news! Your exchange request for the <strong>{product}</strong> (New Size: {size_new}) has been verified and approved.</p>
                
                <div style="background-color: #f9f9f9; border-left: 4px solid #ff003c; padding: 15px; margin: 30px 0;">
                    <p style="margin: 0; font-weight: bold;">Next Steps:</p>
                    <p style="margin-top: 10px;">Our delivery partner will arrive within 2-4 business days to pick up the original item. Once verified, the replacement size will be dispatched immediately.</p>
                    <p style="margin-top: 10px; font-size: 14px; color: #666;">Please ensure the item is unworn with original tags attached.</p>
                </div>
                
                <p>If you have any questions, feel free to reply to this email.</p>
                <p style="margin-top: 30px; font-weight: bold;">LAST GEAR Team</p>
            </body>
        </html>
        """
        
        msg.set_content("Your exchange request has been approved. Next steps involve our courier picking up your original item before dispatching the requested replacement.")
        msg.add_alternative(html_content, subtype='html')
        
        def send_email_sync():
            with smtplib.SMTP_SSL('smtp.gmail.com', 465) as smtp:
                smtp.login(email_username, email_password)
                smtp.send_message(msg)
                
        await asyncio.to_thread(send_email_sync)
        logger.info(f"Exchange approval email sent to {customer_email}")
    except Exception as e:
        logger.error(f"Failed to send exchange approval email: {str(e)}")
