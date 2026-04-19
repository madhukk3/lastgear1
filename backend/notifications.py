import os
import smtplib
from email.message import EmailMessage
import logging
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
from security import create_newsletter_unsubscribe_token

logger = logging.getLogger(__name__)

def get_public_site_url() -> str:
    return (
        os.environ.get('PUBLIC_SITE_URL')
        or os.environ.get('SITE_URL')
        or os.environ.get('WEBSITE_URL')
        or 'https://lastgear.in'
    ).rstrip('/')


def get_notification_email() -> str:
    return (
        os.environ.get('NOTIFICATION_EMAIL')
        or os.environ.get('EMAIL_USERNAME')
        or ''
    ).strip()


def get_reserved_admin_email() -> str:
    return (os.environ.get('ADMIN_EMAIL') or "").strip().lower()

def build_lastgear_email_shell(eyebrow: str, title: str, intro_html: str, body_html: str, footer_note: str = "Support: support@lastgear.in") -> str:
    return f"""
    <html>
        <body style="margin: 0; padding: 12px; background: #f5efe6; font-family: 'Helvetica Neue', Arial, sans-serif; color: #16120d;">
            <div style="max-width: 640px; margin: 0 auto;">
                <div style="background: #fffaf3; color: #18120d !important; border: 1px solid #eadbc9; border-radius: 22px; overflow: hidden; box-shadow: 0 14px 36px rgba(18,14,11,0.08);">
                    <div style="height: 4px; background: linear-gradient(90deg, #b7814d 0%, #efc28c 50%, #b7814d 100%);"></div>
                    <div style="padding: 16px 18px 0;">
                        <div style="letter-spacing: 0.26em; text-transform: uppercase; font-size: 10px; color: #9c6a3b !important;">LAST GEAR Fashion Division</div>
                    </div>
                    <div style="padding: 18px 18px 20px;">
                        <p style="margin: 0 0 10px; color: #9c6a3b !important; letter-spacing: 0.2em; text-transform: uppercase; font-size: 10px; font-weight: 700;">{eyebrow}</p>
                        <h1 style="margin: 0 0 12px; font-size: 26px; line-height: 0.96; text-transform: uppercase; color: #18120d !important; letter-spacing: 0.01em;">{title}</h1>
                        <div style="max-width: 560px; font-size: 14px; line-height: 1.65; color: #18120d !important;">
                            {intro_html}
                        </div>
                        <div style="margin-top: 16px; border-top: 1px solid #eadbc9; padding-top: 14px;">
                            {body_html}
                        </div>
                    </div>
                </div>
                <div style="padding: 10px 4px 0; font-size: 12px; line-height: 1.55; color: #6f6052;">
                    <p style="margin: 0;">{footer_note}</p>
                    <p style="margin: 4px 0 0;">LAST GEAR Team</p>
                </div>
            </div>
        </body>
    </html>
    """

def build_status_panel(label: str, value: str, accent: str = "#d8b48a", extra_html: str = "") -> str:
    return f"""
    <div style="padding: 0 0 12px; border-bottom: 1px solid #eadbc9;">
        <p style="margin: 0 0 6px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.18em; color: {accent} !important; font-weight: 700;">{label}</p>
        <p style="margin: 0; font-size: 18px; font-weight: 800; text-transform: uppercase; color: #18120d !important; line-height: 1.12;">{value}</p>
        {extra_html}
    </div>
    """


def build_newsletter_unsubscribe_link(email: str) -> str:
    token = create_newsletter_unsubscribe_token(email)
    return f"{get_public_site_url()}/api/newsletter/unsubscribe?token={token}"

async def send_subscriber_welcome_email(email: str):
    """
    Send a welcome email to a new or returning subscriber.
    """
    email_username = os.environ.get('EMAIL_USERNAME')
    email_password = os.environ.get('EMAIL_PASSWORD')

    if not email_username or not email_password:
        logger.warning("EMAIL_USERNAME or EMAIL_PASSWORD not set. Skipping subscriber welcome email.")
        return {"delivered": False, "reason": "missing_credentials"}

    msg = EmailMessage()
    msg['Subject'] = "Welcome to LAST GEAR"
    msg['From'] = email_username
    msg['To'] = email
    unsubscribe_link = build_newsletter_unsubscribe_link(email)
    msg.set_content("You are now subscribed to LAST GEAR updates. New drops. First access.")
    msg.add_alternative(
        build_lastgear_email_shell(
            "Stay In The Shift",
            "You Are In",
            "<p style='margin:0;'>You are now subscribed to LAST GEAR updates. New drops. First access.</p>",
            f"""
            <div style="padding-top: 14px; color: #18120d !important;">
                <p style="margin: 0;">We’ll keep the updates sharp and relevant.</p>
                <p style="margin: 14px 0 0;"><a href="{unsubscribe_link}" style="color:#9c6a3b;text-decoration:none;">Unsubscribe</a></p>
            </div>
            """
        ),
        subtype='html'
    )

    def send_email_sync():
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as smtp:
            smtp.login(email_username, email_password)
            smtp.send_message(msg)

    try:
        await asyncio.to_thread(send_email_sync)
        logger.info("Subscriber welcome email sent to %s", email)
        return {"delivered": True}
    except Exception as e:
        logger.error("Failed to send subscriber welcome email to %s: %s", email, str(e))
        return {"delivered": False, "reason": str(e)}

async def send_newsletter_verification_email(email: str, otp: str):
    """
    Send newsletter verification OTP before saving a subscriber.
    """
    email_username = os.environ.get('EMAIL_USERNAME')
    email_password = os.environ.get('EMAIL_PASSWORD')

    if not email_username or not email_password:
        logger.warning("EMAIL_USERNAME or EMAIL_PASSWORD not set. Skipping newsletter verification email.")
        return {"delivered": False, "reason": "missing_credentials"}

    msg = EmailMessage()
    msg['Subject'] = "Verify your LAST GEAR subscription"
    msg['From'] = email_username
    msg['To'] = email
    msg.set_content(f"Your LAST GEAR verification code is {otp}. It expires in 5 minutes.")
    msg.add_alternative(
        build_lastgear_email_shell(
            "Email Verification",
            "Confirm Your Subscription",
            "<p style='margin: 0;'>Use this code to complete your LAST GEAR subscription.</p>",
            f"""
            {build_status_panel("Verification Code", otp)}
            <div style="padding-top: 14px; color: #18120d !important;">
                <p style="margin: 0;">This code expires in 5 minutes. Enter it on the site to finish subscribing.</p>
            </div>
            """
        ),
        subtype='html'
    )

    def send_email_sync():
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as smtp:
            smtp.login(email_username, email_password)
            smtp.send_message(msg)

    try:
        await asyncio.to_thread(send_email_sync)
        logger.info("Newsletter verification email sent to %s", email)
        return {"delivered": True}
    except Exception as e:
        logger.error("Failed to send newsletter verification email to %s: %s", email, str(e))
        return {"delivered": False, "reason": str(e)}

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
            
            customer_html = build_lastgear_email_shell(
                "Order Confirmed",
                "Your Order Is Locked In",
                f"<p style='margin: 0;'>Hi <strong>{customer_name}</strong>, your LAST GEAR order has been placed successfully.</p>",
                f"""
                <div>
                    {build_status_panel("Order ID", order_id)}
                    {build_status_panel("Payment", payment_text)}
                    {build_status_panel("Order Total", total_amount)}
                    <div style="padding: 14px 0; border-bottom: 1px solid #eadbc9;">
                        <p style="margin: 0 0 10px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.18em; color: #9c6a3b; font-weight: 700;">Selected Pieces</p>
                        <ul style="list-style: none; padding: 0; margin: 0; color: #18120d !important;">
                            {customer_items_html}
                        </ul>
                    </div>
                    <div style="padding: 14px 0; border-bottom: 1px solid #eadbc9; color: #18120d !important;">
                        <p style="margin: 0 0 8px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.18em; color: #9c6a3b; font-weight: 700;">Shipping Address</p>
                        <p style="margin: 0;">{shipping_address_text}</p>
                    </div>
                    <div style="padding: 14px 0 0; color: #18120d !important;">
                        <p style="margin: 0 0 8px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.18em; color: #9c6a3b; font-weight: 700;">Next</p>
                        <p style="margin: 0;">We prepare your order, update you when it moves, and most deliveries arrive in 3 to 7 business days.</p>
                        <p style="margin: 14px 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.16em; color: #9c6a3b; font-weight: 700;">Stay Tuned. Stay In The Shift.</p>
                    </div>
                </div>
                """
            )
            customer_msg.set_content("Please enable HTML viewing to see this email.")
            customer_msg.add_alternative(customer_html, subtype='html')

        # ---------------------------------------------------------
        # 4. BUILD ADMIN EMAIL (Notification)
        # ---------------------------------------------------------
        admin_msg = EmailMessage()
        admin_msg['Subject'] = f"🔔 NEW ORDER ALERT: #{order_id}"
        admin_msg['From'] = email_username
        admin_msg['To'] = to_email
        
        admin_html = build_lastgear_email_shell(
            "Admin Alert",
            "New Order Received",
            f"<p style='margin: 0;'>A fresh LAST GEAR order is ready for review and processing.</p>",
            f"""
            {build_status_panel("Order ID", order_id)}
            {build_status_panel("Customer", customer_name, extra_html=f"<div style='margin-top: 10px; color: #18120d !important;'>{customer_email}<br>{customer_phone}</div>")}
            {build_status_panel("Payment", payment_text, extra_html=f"<div style='margin-top: 10px; color: #18120d !important;'>Status: {admin_payment_status}</div>")}
            {build_status_panel("Order Total", total_amount)}
            <div style="padding: 20px 0; border-bottom: 1px solid #eadbc9; color: #18120d !important;">
                <p style="margin: 0 0 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.22em; color: #9c6a3b;">Ordered Items</p>
                <p style="margin: 0;">{admin_items_text}</p>
            </div>
            <div style="padding: 20px 0; border-bottom: 1px solid #eadbc9; color: #18120d !important;">
                <p style="margin: 0 0 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.22em; color: #9c6a3b;">Delivery Address</p>
                <p style="margin: 0;">{shipping_address_text}</p>
            </div>
            <div style="padding-top: 22px; color: #18120d !important;">
                <p style="margin: 0;">Open the admin panel to process this order: <a href="https://lastgear.in/admin" style="color: #9c6a3b; text-decoration: none;">lastgear.in/admin</a></p>
            </div>
            """,
            footer_note="LAST GEAR Admin Notification"
        )
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
        if customer_email and customer_email.lower() == get_reserved_admin_email():
            return  # Block dummy domain to prevent bounces
        customer_name = order.get('shipping_address', {}).get('full_name', 'Customer')
        
        msg = EmailMessage()
        msg['Subject'] = f"{emoji} Order Status Update: #{order_id} is {new_status}"
        msg['From'] = email_username
        msg['To'] = customer_email
        
        tracking_html = f"<div style='margin-top: 10px; color: #18120d !important;'><strong>Tracking Number:</strong> {tracking_number}</div>" if tracking_number else ""
        
        html_content = build_lastgear_email_shell(
            "Order Update",
            "Status Shift",
            f"<p style='margin: 0;'>Hi <strong>{customer_name}</strong>, your LAST GEAR order <strong>#{order_id}</strong> has a fresh update.</p>",
            f"""
            {build_status_panel("Current Status", f"{emoji} {new_status}", extra_html=tracking_html)}
            <div style="padding-top: 14px; color: #18120d !important;">
                <p style="margin: 0;">We will keep you posted as your order moves through the next stage.</p>
                <p style="margin: 14px 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.16em; color: #9c6a3b; font-weight: 700;">Stay Tuned. Stay In The Shift.</p>
            </div>
            """
        )
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
    to_email = get_notification_email()
    
    if not email_username or not email_password or not to_email:
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
        if customer_email and customer_email.lower() == get_reserved_admin_email():
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
        
        admin_text = f"A cancellation request has been approved by admin.\n\nOrder ID: {order_id}\nCustomer: {customer_name}\nPayment Method: {payment_text}\nTotal Amount: {total_amount}\n\nProducts:\n{admin_items_text.strip()}\n\nStatus: Order Cancelled\nTime: {timestamp}\n"
        admin_html = build_lastgear_email_shell(
            "Admin Alert",
            "Order Cancelled",
            f"<p style='margin: 0;'>An order cancellation has been approved and marked complete.</p>",
            f"""
            {build_status_panel("Order ID", order_id, accent="#e78b7a")}
            {build_status_panel("Customer", customer_name)}
            {build_status_panel("Payment", payment_text)}
            {build_status_panel("Order Total", total_amount)}
            <div style="padding: 20px 0; border-bottom: 1px solid #eadbc9; color: #18120d !important;">
                <p style="margin: 0 0 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.22em; color: #9c6a3b;">Cancelled Items</p>
                <p style="margin: 0; white-space: pre-line;">{admin_items_text.strip()}</p>
            </div>
            <div style="padding-top: 22px; color: #18120d !important;">
                <p style="margin: 0;">Processed at {timestamp}</p>
            </div>
            """,
            footer_note="LAST GEAR Admin Notification"
        )
        
        admin_msg.set_content(admin_text)
        admin_msg.add_alternative(admin_html, subtype='html')

        # 2. Customer Email
        customer_msg = None
        if customer_email:
            customer_msg = EmailMessage()
            customer_msg['Subject'] = f"❌ Order Cancelled: #{order_id}"
            customer_msg['From'] = email_username
            customer_msg['To'] = customer_email
            
            customer_html = build_lastgear_email_shell(
                "Order Cancelled",
                "Cancellation Confirmed",
                f"<p style='margin: 0;'>Hi <strong>{customer_name}</strong>, your order <strong>#{order_id}</strong> has been cancelled successfully.</p>",
                f"""
                {build_status_panel("Current Status", "Cancelled", accent="#e78b7a")}
                <div style="padding-top: 14px; color: #18120d !important;">
                    <p style="margin: 0;">If this was a prepaid order, the refund will usually reflect within 5 to 7 business days.</p>
                    <p style="margin: 14px 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.16em; color: #9c6a3b; font-weight: 700;">Stay Tuned. Stay In The Shift.</p>
                </div>
                """
            )
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
        
    except Exception as e:
        logger.error(f"Failed to send order cancellation email: {str(e)}")

async def send_exchange_request_email(exchange: dict):
    """
    Alerts the admin that a new exchange request has been submitted.
    """
    email_username = os.environ.get('EMAIL_USERNAME')
    email_password = os.environ.get('EMAIL_PASSWORD')
    admin_email = get_notification_email()
    
    if not email_username or not email_password or not admin_email:
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
        html_content = build_lastgear_email_shell(
            "Admin Alert",
            "Exchange Request",
            f"<p style='margin: 0;'>A customer has submitted a new exchange request and it is ready for review.</p>",
            f"""
            {build_status_panel("Request ID", request_id)}
            {build_status_panel("Order ID", order_id)}
            {build_status_panel("Customer", customer_name, extra_html=f"<div style='margin-top: 10px; color: #18120d !important;'>{email}<br>{phone}</div>")}
            <div style="padding: 20px 0; border-bottom: 1px solid #eadbc9; color: #18120d !important;">
                <p style="margin: 0 0 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.22em; color: #9c6a3b;">Product Detail</p>
                <p style="margin: 0;">{product}</p>
                <p style="margin: 10px 0 0;">Purchased size: {size_old}<br>Requested size: {size_new}</p>
            </div>
            <div style="padding: 20px 0; border-bottom: 1px solid #eadbc9; color: #18120d !important;">
                <p style="margin: 0 0 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.22em; color: #9c6a3b;">Reason</p>
                <p style="margin: 0;">{reason}</p>
            </div>
            <div style="padding-top: 22px; color: #18120d !important;">
                <p style="margin: 0;">Defect image: {image_url}</p>
            </div>
            """,
            footer_note="LAST GEAR Admin Notification"
        )
        msg.set_content(text_content)
        msg.add_alternative(html_content, subtype='html')
        
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
        
        html_content = build_lastgear_email_shell(
            "Exchange Update",
            "Exchange Approved",
            f"<p style='margin: 0;'>Hi <strong>{customer_name}</strong>, your exchange request for <strong>{product}</strong> in size <strong>{size_new}</strong> has been approved.</p>",
            f"""
            {build_status_panel("Next Move", "Pickup Then Replacement", accent="#d8b48a")}
            <div style="padding-top: 14px; color: #18120d !important;">
                <p style="margin: 0 0 10px;">Our delivery partner will arrive within 2 to 4 business days to collect the original piece.</p>
                <p style="margin: 0;">After verification, the replacement size will be dispatched immediately. Please keep the item unworn and with original tags.</p>
                <p style="margin: 14px 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.16em; color: #9c6a3b; font-weight: 700;">Stay Tuned. Stay In The Shift.</p>
            </div>
            """
        )
        
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

async def send_subscriber_broadcast_email(
    subject: str,
    message: str,
    recipients: list[str],
    preheader: str | None = None,
    cta_label: str | None = None,
    cta_link: str | None = None
):
    """
    Send a branded update email to newsletter subscribers.
    """
    email_username = os.environ.get('EMAIL_USERNAME')
    email_password = os.environ.get('EMAIL_PASSWORD')

    if not email_username or not email_password or not recipients:
        logger.warning("Missing email credentials or recipients for subscriber broadcast.")
        return {"sent_count": 0, "failed_count": len(recipients or []), "failed_recipients": recipients or []}

    safe_subject = subject.strip()
    safe_message = message.replace("\n", "<br>")
    safe_preheader = (preheader or "New drop. First access.").strip()
    button_html = ""

    if cta_label and cta_link:
        button_html = f"""
        <div style="margin-top: 28px;">
            <a href="{cta_link}" style="display: inline-block; background: #120e0b; color: #f8f2ea; text-decoration: none; padding: 14px 24px; border-radius: 999px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; font-size: 12px;">
                {cta_label}
            </a>
        </div>
        """

    def send_email_sync():
        sent_count = 0
        failed_recipients = []
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as smtp:
            smtp.login(email_username, email_password)
            for recipient in recipients:
                try:
                    unsubscribe_link = build_newsletter_unsubscribe_link(recipient)
                    html_content = build_lastgear_email_shell(
                        "Stay In The Shift",
                        safe_subject,
                        f"<p style='margin:0;'>{safe_message}</p>",
                        f"""
                        <div style="padding-top: 14px; color: #18120d !important;">
                            <p style="margin: 0;">You are receiving this because you subscribed to LAST GEAR updates.</p>
                            {button_html}
                            <p style="margin: 16px 0 0;"><a href="{unsubscribe_link}" style="color:#9c6a3b;text-decoration:none;">Unsubscribe</a></p>
                        </div>
                        """
                    )
                    msg = EmailMessage()
                    msg['Subject'] = safe_subject
                    msg['From'] = email_username
                    msg['To'] = recipient
                    msg.set_content(f"{safe_preheader}\n\n{message}")
                    msg.add_alternative(html_content, subtype='html')
                    smtp.send_message(msg)
                    sent_count += 1
                except Exception as recipient_error:
                    failed_recipients.append(recipient)
                    logger.error("Failed subscriber email for %s: %s", recipient, str(recipient_error))

        return {
            "sent_count": sent_count,
            "failed_count": len(failed_recipients),
            "failed_recipients": failed_recipients
        }

    try:
        result = await asyncio.to_thread(send_email_sync)
        logger.info(
            "Subscriber broadcast completed. sent=%s failed=%s",
            result["sent_count"],
            result["failed_count"]
        )
        return result
    except Exception as e:
        logger.error(f"Failed to send subscriber broadcast email: {str(e)}")
        return {"sent_count": 0, "failed_count": len(recipients), "failed_recipients": recipients}
