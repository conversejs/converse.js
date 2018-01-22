<?php include('head.html'); ?>
<link type="text/css" rel="stylesheet" media="screen" href="https://cdn.conversejs.org/3.2.1/css/converse.min.css" />
<link type="text/css" rel="stylesheet" media="screen" href="css/mockup.css" />
</head>

<body>
	<?php include('menu.html'); ?>

	<div id="conversejs" class="chatbox">
		<div id="controlbox" class="chatbox">
			<div class="flyout box-flyout">
				<div class="controlbox-panes">
					<div class="row">
						<div class="col-12">
							<?php include('sidebar.html'); ?>
							<?php include('user-panel.html'); ?>
						</div>
					</div>
				</div>
			</div>
		</div>

		<div class="chatbox" id="37c0c87392010303765fe36b05c0967d62c6b70f">
			<div class="flyout box-flyout">
				<div class="chat-head chat-head-chatbox d-flex">
					<div><canvas height="32" width="32" class="avatar"></canvas></div>
					<div class="chat-title w-100">JC Brand
						<p class="user-custom-message" title="10000ft in the air">10000ft in the air</p>
					</div>
					<a class="chatbox-btn fa fa-vcard" title="Contact profile" data-toggle="modal" data-target="#contactProfileModal"></a>
					<a class="chatbox-btn fa fa-close" title="Close this chat box"></a>
				</div>

				<div class="chat-body">
					<div class="chat-content">
						<div class="chat-info">
							<span class="badge badge-info">This is an info message</span></div>
						<div class="chat-info">
							<span class="badge badge-danger">This is an error message</span></div>
						<div class="chat-message">
							<span class="chat-msg-author chat-msg-me">09:35&nbsp;
								<canvas height="24" width="24" class="avatar"></canvas>
								<span class="chat-msg-me">me:&nbsp;</span>
							</span>
							<span class="chat-msg-content">Hello world
								<span class="fa fa-smile-o"></span>
							</span>
						</div>
						<div class="chat-message">
							<span class="chat-msg-author chat-msg-them">19:25&nbsp;
								<canvas height="24" width="24" class="avatar"></canvas>
								<span class="chat-msg-them">Benedict-John:&nbsp;</span>
							</span>
							<span class="chat-msg-content">Dagsê</span>
						</div>
						<div class="chat-message">
							<span class="chat-msg-author chat-msg-me">19:39&nbsp;
								<canvas height="24" width="24" class="avatar"></canvas>
								<span class="chat-msg-me">me:&nbsp;</span>
							</span>
							<span class="chat-msg-content">This is a relatively long message to check that wrapping works as expected.</span>
						</div>
						<div class="chat-message">
							<span class="chat-msg-author chat-msg-me">19:42&nbsp;
								<canvas height="24" width="24" class="avatar"></canvas>
								<span class="chat-msg-me">me:&nbsp;</span>
							</span>
							<span class="chat-msg-content">Supercalifragilisticexpialidociousstillnotlongenough</span>
						</div>
						<div class="chat-info chat-event">
							<span class="badge badge-success">JC Brand is busy</span>
						</div>
						<div class="chat-message">
							<span class="chat-msg-author chat-msg-me">19:43&nbsp;
								<canvas height="24" width="24" class="avatar"></canvas>
								<span class="chat-msg-me">me:&nbsp;</span>
							</span>
							<span class="chat-msg-content">Another message to check that scrolling works.</span>
						</div>
					</div>

					<form class="sendXMPPMessage">
						<div class="form-group">
							<ul class="chat-toolbar no-text-select">
								<li class="toggle-toolbar-menu toggle-smiley fa fa-smile-o" title="Insert a smiley">
									<div class="emoji-picker-container toolbar-menu collapsed"></div>
								</li>

								<li class="toggle-clear">
									<a class="fa fa-trash" title="Clear all messages"></a>
								</li>

								<li class="toggle-toolbar-menu toggle-otr unencrypted" title="Your messages are not encrypted. Click here to enable OTR encryption.">
									<span class="chat-toolbar-text">unencrypted</span>
									<span class="fa fa-unlock"></span>
									<ul class="toolbar-menu collapsed">
										<li>
											<a class="start-otr" href="#">Start encrypted conversation</a>
										</li>
										<li>
											<a href="http://www.cypherpunks.ca/otr/help/3.2.0/levels.php" target="_blank" rel="noopener">What's this?</a>
										</li>
									</ul>
								</li>
							</ul>
						</div>
						<div class="form-group">
							<textarea class="form-control" placeholder="Personal message"></textarea>
						</div>
					</form>
				</div>
			</div>
		</div>

		<div class="chatbox chatroom" id="4a77380f1cd9d392627b0e1469688f9ca44e9392">
			<div class="flyout box-flyout">
				<div class="chat-head chat-head-chatroom d-flex">
					<div class="w-100">
						<div class="chat-title">Chatroom</div>
						<p class="chatroom-topic">May the force be with you</p>
					</div>
					<a class="chatbox-btn fa fa-wrench"></a>
					<a class="chatbox-btn fa fa-minus"></a>
					<a class="chatbox-btn fa fa-close"></a>
				</div>

				<div class="chat-body chatroom-body">
					<div class="row">
						<div class="col-md-9 col-8">
							<div class="chat-area">
								<div class="chat-content">
									<div class="chat-message">
										<span class="chat-msg-author chat-msg-room">18:50&nbsp;
											<canvas height="24" width="24" class="avatar"></canvas>
											<span class="chat-msg-room">luke:&nbsp;</span>
										</span>
										<span class="chat-msg-content">leia: hi :)</span>
									</div>
									<div class="chat-message">
										<span class="chat-msg-author chat-msg-room">19:40&nbsp;
											<canvas height="24" width="24" class="avatar"></canvas>
											<span class="chat-msg-room">leia:&nbsp;</span>
										</span>
										<span class="chat-msg-content">I'll be gone for a while, will be back in about an hour</span>
									</div>
									<time class="chat-info badge badge-info" datetime="2013-06-04T00:00:00.000Z">Tue Jun 04 2013</time>
									<div class="chat-message">
										<span class="chat-msg-author chat-msg-room">19:40&nbsp;
											<canvas height="24" width="24" class="avatar"></canvas>
											<span class="chat-msg-room">Obi-wan Kenobi, Jedi Master:&nbsp;</span>
										</span>
										<span class="chat-msg-content">I'll be gone for a while, will be back in about an hour</span>
									</div>
									<div class="chat-message">
										<span class="chat-msg-author chat-msg-me">19:42&nbsp;
											<canvas height="24" width="24" class="avatar"></canvas>
											<span class="chat-msg-me">me:&nbsp;</span>
										</span>
										<span class="chat-msg-content">Supercalifragilisticexpialidociousstillnotlongenough</span>
									</div>
									<div class="chat-message">
										<span class="chat-msg-author chat-msg-room">19:43&nbsp;
											<canvas height="24" width="24" class="avatar"></canvas>
											<span class="chat-msg-roomme">Obi-wan Kenobi, Jedi Master:&nbsp;</span>
										</span>
										<span class="chat-msg-content">Another message to check that scrolling works.</span>
									</div>
								</div>
								<form class="sendXMPPMessage">
									<div class="form-group">
										<ul class="chat-toolbar no-text-select">
											<li class="toggle-smiley fa fa-smile-o" title="Insert a smiley"></li>
											<li class="toggle-occupants"><a class="fa fa-user-times" title="Hide the list of occupants"></a></li>
											<li class="toggle-clear"><a class="fa fa-times" title="Clear all messages"></a></li>
										</ul>
									</div>
									<div class="form-group">
										<textarea class="form-control" placeholder="Message"></textarea>
									</div>
								</form>
							</div>
						</div>

						<div class="col-md-3 col-4">
							<div class="occupants w-100">
								<p class="occupants-heading">Occupants:</p>
								<form class="pure-form room-invite">
									<div class="form-control">
										<input class="form-control" placeholder="Invite..." type="text" autocomplete="off" spellcheck="false" dir="auto">
									</div>
									<pre aria-hidden="true" style="position: absolute; visibility: hidden; white-space: pre;"></pre>
								</form>

								<ul class="occupant-list">
									<li class="moderator occupant" title="This user is a moderator. Click to mention luke in your message.">
										<div class="occupant-status occupant-online circle" title="Online"></div>luke</li>
									<li class="participant occupant" title="Click to mention leia in your message.">
										<div class="occupant-status occupant-online circle" title="Online"></div>leia</li>
									<li class="participant occupant" title="Click to mention Obi-wan Kenobi, Jedi Master in your message.">
										<div class="occupant-status occupant-online circle" title="Online"></div>Obi-wan Kenobi, Jedi Master</li>
									<li class="participant occupant" title="Click to mention jabber the hut in your message.">
										<div class="occupant-status occupant-online circle" title="Online"></div>jabber the hut</li>
								</ul>

								<div class="chatroom-features">
									<p class="occupants-heading">Features</p>
									<ul class="features-list">
										<li class="feature" title="Unsecured: This room requires a password before entry"><span class="fa fa-unlock"></span>&nbsp;</li>
										<li class="feature" title="Public: This room is publicly searchable"><span class="fa fa-eye"></span>&nbsp;</li>
										<li class="feature" title="Open: Anyone can join this roo"><span class="fa fa-globe"></span>&nbsp;</li>
										<li class="feature" title="Persistent: This room persists even if it's unoccupied"><span class="fa fa-save"></span>&nbsp;</li>
										<li class="feature" title="Non-anonymous: All other room occupants can see your XMPP username"><span class="fa fa-vcard"></span>&nbsp;</li>
										<li class="feature" title="Unmoderated: This room is not being moderated"><span class="fa fa-info-circle"></span>&nbsp;</li>
									</ul>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>

		<div id="minimized-chats">
			<a id="toggle-minimized-chats" href="#">Minimized
				<span id="minimized-count">(0)</span>
				<span class="badge badge-light">322</span>
			</a>
			<div class="flyout minimized-chats-flyout">
				<div class="chat-head chat-head-chatroom d-flex">
					<span class="badge badge-light">3</span>
					<a href="#" class="restore-chat w-100 align-self-center" title="Click to maximize this chat">Restricted Chatroom</a>
					<a class="chatbox-btn close-chatbox-button fa fa-times"></a>
				</div>
				<div class="chat-head chat-head-chatbox d-flex">
					<span class="badge badge-light">42</span>
					<a href="#" class="restore-chat w-100 align-self-center" title="Click to maximize this chat">JC Brand</a>
					<a class="chatbox-btn close-chatbox-button fa fa-times"></a>
				</div>
				<div class="chat-head chat-head-chatroom d-flex">
					<a href="#" class="restore-chat w-100 align-self-center" title="Click to maximize this chat">My Chatroom</a>
					<a class="chatbox-btn close-chatbox-button fa fa-times"></a>
				</div>
				<div class="chat-head chat-head-chatbox d-flex">
					<a href="#" class="restore-chat w-100 align-self-center" title="Click to maximize this chat">Annegreet Gomez</a>
					<a class="chatbox-btn close-chatbox-button fa fa-times"></a>
				</div>
				<div class="chat-head chat-head-chatbox d-flex">
					<span class="badge badge-light">842</span>
					<a href="#" class="restore-chat w-100 align-self-center" title="Click to maximize this chat">Asmaa Haakman</a>
					<a class="chatbox-btn close-chatbox-button fa fa-times"></a>
				</div>
				<div class="chat-head chat-head-chatbox d-flex">
					<a href="#" class="restore-chat w-100 align-self-center">Lena Grunewald</a>
					<a class="chatbox-btn close-chatbox-button fa fa-times"></a>
				</div>
			</div>
		</div>
	</div>

	<!-- Contact Profile Modal -->
	<div class="modal fade" id="contactProfileModal" tabindex="-1" role="dialog" aria-labelledby="contactProfileModalLabel" aria-hidden="true">
		<div class="modal-dialog" role="document">
			<div class="modal-content">
				<div class="modal-header">
					<h5 class="modal-title" id="contactProfileModalLabel">JC Brand User Profile</h5>
					<button type="button" class="close" data-dismiss="modal" aria-label="Close">
						<span aria-hidden="true">&times;</span>
					</button>
				</div>
				<div class="modal-body">
				</div>
				<div class="modal-footer">
					<button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
				</div>
			</div>
		</div>
	</div>

	<?php include('modals.html'); ?>
</body>
</html>
