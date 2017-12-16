<?php include('head.html'); ?>
<link type="text/css" rel="stylesheet" media="screen" href="https://cdn.conversejs.org/3.2.1/css/inverse.min.css" />
<link type="text/css" rel="stylesheet" media="screen" href="css/mockup.css" />
</head>

<body>
	<?php include('menu.html'); ?>

	<div class="container-fluid">
		<div id="conversejs" class="fullscreen chatbox">
			<div id="controlbox" class="chatbox">
				<div class="flyout box-flyout">
					<div class="controlbox-panes">
						<div class="row">
							<div class="col-xl-2 col-md-3">
								<?php include('sidebar.html'); ?>
								<?php include('user-panel.html'); ?>
							</div>
						</div>
					</div>
				</div>
			</div>

			<div class="chatbox chatroom" id="4a77380f1cd9d392627b0e1469688f9ca44e9392">
				<div class="row">
					<div class="col-xl-10 offset-xl-2 col-md-9 offset-md-3">
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
				</div>
			</div>
		</div>

		<?php include('modals.html'); ?>
	</div>
</body>

</html>
